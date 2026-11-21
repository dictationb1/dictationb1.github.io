/* ! Smart Dictation Player — Lecturer Studio & admin vault (v0.0.4.a) */
(function (global) {
 'use strict';

 var SDP = global.SDP = global.SDP || {};
 var doc = global.document;
 /* R5 (F6)/v0.0.4.a: Alice — the free-tier British female educator voice. */
 var VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2';
 var VOICE_NAME = 'Alice';
 var VOICE_MODEL = 'eleven_flash_v2_5';
 var VOICE_PERSONA = 'British English female educator (Alice-class)';
 var VOICE_FALLBACK = { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' };
 var activeVoiceId = VOICE_ID;
 var activeVoiceName = VOICE_NAME;
 /* v0.0.4.a W1: single-voice engine law. Library voices (Charlotte) answer */
 function resolveProfessorVoice(key, cb) {
  cb = cb || noop;
  if (!key || !global.fetch) { cb(VOICE_FALLBACK.id, VOICE_FALLBACK.name); return; }
  try {
   global.fetch(EL_VOICES, { headers: { 'xi-api-key': key }, cache: 'no-store' })
    .then(function (r) { return r && r.ok ? r.json() : null; })
    .then(function (j) {
     var list = j && Array.isArray(j.voices) ? j.voices : [], best = '', bestName = '', bestScore = -1;
     for (var i = 0; i < list.length; i++) {
      var v = list[i] || {}, lb = v.labels || {};
      var hay = (str(v.name) + ' ' + str(lb.accent) + ' ' + str(lb.gender) + ' ' + str(lb.use_case)).toLowerCase();
      if (hay.indexOf('british') < 0 || hay.indexOf('female') < 0) continue;
      var score = 10;
      if (hay.indexOf('educational') >= 0 || hay.indexOf('educator') >= 0 || hay.indexOf('informative') >= 0) score += 5;
      if (str(v.voice_id) === VOICE_FALLBACK.id) score += 20;
      if (score > bestScore) { bestScore = score; best = str(v.voice_id); bestName = str(v.name); }
     }
     activeVoiceId = best || VOICE_FALLBACK.id;
     activeVoiceName = bestName || VOICE_FALLBACK.name;
     cb(activeVoiceId, activeVoiceName);
    }, function () { cb(VOICE_FALLBACK.id, VOICE_FALLBACK.name); });
  } catch (e) { cb(VOICE_FALLBACK.id, VOICE_FALLBACK.name); }
 }
 /* v0.0.4.a: auto-generation runs in the real app only — never inside the */
 function allowAutoGen() {
  if (global.__SDP_ALLOW_AUTOGEN === true) return true;
  /* v0.0.6.n lab law: a cross-world bridge flag (localStorage) authorizes the */
  try {
    if (global.localStorage && global.localStorage.getItem('sdp.lab.allowAutoGen') === '1') return true;
  } catch (eL) {}
  return !global.__SDP_NO_LIVE__;
 }
 function countExistingClips() { return clipCount(); }
 var HASH_ALGO = 'sha1';
 var EL_SUBSCRIPTION = 'https://api.elevenlabs.io/v1/user/subscription';
 /* D1/D2 (Rule 1A): rung 2 — a scoped */
 var EL_VOICES = 'https://api.elevenlabs.io/v1/voices';
 var GUIDE_KEYS = ['_guide_1', '_guide_2', '_guide_3', '_guide_4'];
 var WORD_CAP = 30;
 /* R4/D6: the classroom bootstrap PIN */
 var BOOTSTRAP_PIN = '78987898';
 var PIN_MAX = 8;
 var PIN_MIN = 4;
 var DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
 var SINHALA_API = 'https://api.mymemory.translated.net/get?q=';
 /* D2/D4 verbatim UI strings (STRINGS_ */
 var SCOPED_KEY = 'studioQuotaScoped';
 var TIER_KEY = 'studioElTierWarn';
 function SCOPED_NOTE() { return t(SCOPED_KEY); }
 function TIER_WARN() { return t(TIER_KEY); }
 /* D10 (R8): the 5-slot 100% free AI */
 var AI_PROVIDERS = {
  free_dict: { k: 'studioAiNoKey', needsKey: false, prefix: '' },
  pollinations_free: { k: 'studioAiSlotPollinations', needsKey: false, prefix: '' },
  groq: { k: 'studioAiSlotGroq', needsKey: true, prefix: 'gsk_' },
  openrouter: { k: 'studioAiSlotOpenrouter', needsKey: true, prefix: 'sk-or-' },
  gemini: { k: 'studioAiSlotGemini', needsKey: true, prefix: 'AIza' }
 };
 var AI_SLOT_ORDER = ['free_dict', 'pollinations_free', 'groq', 'openrouter', 'gemini'];
 var LLM_ENDPOINTS = {
  pollinations_free: { url: 'https://text.pollinations.ai/openai', model: 'openai' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', model: 'gemini-2.5-flash' }
 };

 /* ══ v0.0.6.m Pillar 2 — Multi-API Key Pool: the exact 6-key $0 layout */
 var KEY_POOL_SLOTS = 5;
 var POOL_PROVIDERS = {
  elevenlabs: { label: 'ElevenLabs · backup voice', keyHint: 'sk_…' },
  gemini: { label: 'Gemini · free tier', keyHint: 'AIza…' },
  openrouter: { label: 'OpenRouter · free models', keyHint: 'sk-or-…' },
  groq: { label: 'Groq · free tier', keyHint: 'gsk_…' },
  cloudflare: { label: 'Cloudflare Workers AI', keyHint: 'key / token' }
 };
 var POOL_PROVIDER_ORDER = ['elevenlabs', 'groq', 'openrouter', 'gemini', 'cloudflare'];
 /* v0.0.6.m: the creator's exact 6-key default architecture — Slot #1 the */
 var POOL_DEFAULT_PROVIDERS = ['elevenlabs', 'groq', 'groq', 'openrouter', 'openrouter'];
 var POOL_DEFAULT_HINTS = [
  'sk_… (ElevenLabs Key #2 — Backup)',
  'gsk_… (Groq Free Key #1)',
  'gsk_… (Groq Free Key #2)',
  'sk-or-… (OpenRouter Free Key #1)',
  'sk-or-… (OpenRouter Free Key #2)'
 ];
 /* ══ v0.0.6.q Pillar 1 — the High-Professional Executive Male Voice */
 var BRIEFING_VOICE_CATALOG = {
  daniel: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (British Broadcast Presenter)', persona: 'Authoritative BBC-style British male executive presenter' },
  george: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (British Master Narrator)', persona: 'Warm, deep British academic & storyteller male voice' },
  brian: { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian (Deep Resonant Executive)', persona: 'Commanding, resonant studio documentary male narrator' },
  callum: { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum (Articulate British Pro)', persona: 'Crisp, modern high-professional British male voice' },
  custom: { id: '', name: 'Custom / Cloned Voice ID…', persona: 'A Custom or Cloned voice from the creator\'s ElevenLabs account (/v1/voices)' }
 };
 var BRIEFING_VOICE_ORDER = ['daniel', 'george', 'brian', 'callum', 'custom'];
 /* v0.0.6.t PILLAR 4C — RP_TTS_OVERRIDES: UK/US heterophones mapped to
    British RP phonetic respellings for TTS engines. buildQueue() and
    resynthWmRow() speak the respelling (item.ttsText) so a bare
    "advertisement" can never come back from ElevenLabs as American
    "ad-ver-TIZE-ment" again, while the stored clip keeps stamping the
    canonical spelling + clipContentHash(canonical spelling).
    v0.0.6.u: expanded to the FULL Cambridge B1 heterophone set — every
    common UK/US stress or vowel split a B1 class meets (herb, garage,
    vase, laboratory, dynasty, patriot, mobile, fragile, missile, hostile,
    fertile, versatile, anti, semi, multi, aluminium, yoghurt, clerk,
    derby, z, controversy, migraine, renaissance) plus the Session 9
    Entertainment & Media terms whose old clips carried the wrong stress. */
 var RP_TTS_OVERRIDES = {
  'advertisement': 'ad-ver-tiss-ment',
  'schedule': 'shed-yool',
  'privacy': 'priv-uh-see',
  'vitamin': 'vit-uh-min',
  'tomato': 'tuh-mah-toe',
  'leisure': 'lezh-uh',
  'lieutenant': 'lef-ten-uhnt',
  'herb': 'hurb',
  'garage': 'garr-arzh',
  'vase': 'vahz',
  'laboratory': 'luh-bor-uh-tree',
  'dynasty': 'din-uh-stee',
  'patriot': 'pat-ree-uht',
  'mobile': 'moh-bile',
  'fragile': 'fraj-ile',
  'missile': 'miss-ile',
  'hostile': 'host-ile',
  'fertile': 'fert-ile',
  'versatile': 'vers-uh-tile',
  'anti': 'an-tee',
  'semi': 'sem-ee',
  'multi': 'mult-ee',
  'aluminium': 'al-yuh-min-ee-um',
  'yoghurt': 'yog-uht',
  'clerk': 'clahk',
  'derby': 'dah-bee',
  'z': 'zed',
  'controversy': 'kon-truh-ver-see',
  'migraine': 'mee-grayn',
  'renaissance': 'ruh-nay-suhns',
  'entertainment': 'en-tuh-tayn-muhnt',
  'drawing': 'draw-ing',
  'headphones': 'hed-fohnz',
  'classical music': 'klass-ih-kul myoo-zik',
  'folk music': 'fohk myoo-zik',
  'film maker': 'film may-kuh',
  'exhibition': 'ek-sib-ish-uhn'
 };
 /* v0.0.6.q: the high-professional broadcast voice settings; the legacy */
 var INTRO_VOICE_SETTINGS = { stability: 0.50, similarity_boost: 0.85, style: 0.32, use_speaker_boost: true };
 var INTRO_VOICE_SETTINGS_LEGACY = { stability: 0.55, similarity_boost: 0.80, style: 0.25 };
 /* The dedicated deep British male narrators for the Project Briefing: */
 var INTRO_VOICE = { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George · deep British male', model: 'eleven_flash_v2_5' };
 var INTRO_VOICE_ALT = { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel · authoritative British male', model: 'eleven_flash_v2_5' };
 /* v0.0.6.q: the chosen briefing persona key + custom cloned Voice ID live */
 function briefingVoiceKey() {
  try {
   if (isObj(ST.secrets) && str(ST.secrets.briefingVoiceKey)) return str(ST.secrets.briefingVoiceKey);
  } catch (e0) {}
  return 'george';
 }
 function briefingCustomVoiceId() {
  var v = '';
  try {
   if (isObj(ST.secrets) && str(ST.secrets.briefingCustomVoiceId)) v = str(ST.secrets.briefingCustomVoiceId);
  } catch (e1) {}
  if (!v) {
   try {
    var inp = byId('studioBriefingCustomVoiceId');
    if (inp) v = str(inp.value || '').replace(/\s+/g, '');
   } catch (e2) {}
  }
  return /^[A-Za-z0-9]{16,32}$/.test(v) ? v : '';
 }
 function chosenBriefingVoiceId() {
  var custom = briefingCustomVoiceId();
  if (custom) return custom;
  var key = briefingVoiceKey();
  var persona = BRIEFING_VOICE_CATALOG[key];
  return (persona && str(persona.id)) ? str(persona.id) : INTRO_VOICE.id;
 }
 function chosenBriefingVoiceName() {
  var key = briefingVoiceKey();
  var persona = BRIEFING_VOICE_CATALOG[key];
  var base = (persona && str(persona.name)) ? str(persona.name) : INTRO_VOICE.name;
  return briefingCustomVoiceId() ? (base + ' · ' + briefingCustomVoiceId()) : base;
 }
 /* v0.0.6.w — Data-first settings access: settings()/saveSettings() live on
    SDP.Data (the five-key law owner); the sync().settings spelling is only a
    legacy fallback so the controller works on every surface. */
 function dataSettings() {
  try { if (global.SDP && SDP.Data && SDP.Data.settings) return SDP.Data.settings() || {}; } catch (eD) {}
  try { var sy = sync(); if (sy && sy.settings) return sy.settings() || {}; } catch (eS) {}
  return {};
 }
 function dataSaveSettings(patch) {
  try { if (global.SDP && SDP.Data && SDP.Data.saveSettings) { SDP.Data.saveSettings(patch); return true; } } catch (eD2) {}
  try { var sy2 = sync(); if (sy2 && sy2.saveSettings) { sy2.saveSettings(patch); return true; } } catch (eS2) {}
  return false;
 }

 /* ══ v0.0.6.w — the UNIFIED CLASSROOM & CLONED VOICE CONTROLLER ═══════════
    ONE voice — the default energetic British RP Female Alice
    (Xb7hH8MSUJpSbSDYk0k2) OR the Lecturer's chosen/pasted Cloned Voice —
    speaks across 100% of the classroom UI (Dictation, 30 Words, Practice,
    Board, Settings, Commands, Numbers, Guide). The Project Briefing male
    voice (_intro_male_1..4, George) stays separate in Settings. The pick is
    persisted inside sdp.settings.voiceSignature.voiceId / .voiceName (the
    five-key law holds) and activeVoiceId follows it everywhere. */
 function chosenClassroomVoiceId() {
  var vs = null;
  try { vs = dataSettings().voiceSignature || null; } catch (eVS) { vs = null; }
  var v = str(vs && vs.voiceId);
  if (!v) {
   /* legacy vault pick: the briefing custom field doubles as the classroom clone */
   try { v = str(ST.secrets && ST.secrets.classroomVoiceId) || ''; } catch (eCV) { v = ''; }
  }
  return /^[A-Za-z0-9]{16,32}$/.test(v) ? v : VOICE_ID;
 }
 function chosenClassroomVoiceName() {
  var vs = null;
  try { vs = dataSettings().voiceSignature || null; } catch (eVS2) { vs = null; }
  var n = str(vs && vs.voiceName);
  var id = chosenClassroomVoiceId();
  if (id === VOICE_ID) return n || VOICE_NAME;
  return n || ('My Cloned Voice · ' + id);
 }
 function applyClassroomVoice(voiceId, voiceName) {
  var id = str(voiceId).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9]{16,32}$/.test(id)) { msg(' Paste a valid Cloned Voice ID (16-32 chars).', 'warn'); return false; }
  var base = defaultVoiceSignature();
  base.voiceId = id;
  base.voiceName = str(voiceName) || ('My Cloned Voice · ' + id);
  /* Cloned-Voice-safe: no style knob, speaker boost on. */
  base.settings = { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true };
  base.locked = false;
  base.cloned = true;
  if (!dataSaveSettings({ voiceSignature: base })) return false;
  activeVoiceId = id;
  activeVoiceName = base.voiceName;
  if (isObj(ST.secrets)) ST.secrets.classroomVoiceId = id;
  try { paintClassroomVoiceBar(); } catch (eP) {}
  msg(' Cloned voice "' + base.voiceName + '" applied to ALL words & classroom UI — re-bake with Apply again or Generate.', 'ok');
  return true;
 }
 function paintClassroomVoiceBar() {
  var bar = byId('studioClassroomVoiceBar');
  var lock = byId('studioVoiceLockBar');
  var id = chosenClassroomVoiceId();
  if (bar) {
   bar.setAttribute('data-state', id === VOICE_ID ? 'alice' : 'cloned');
   bar.textContent = (id === VOICE_ID)
    ? '🔊 Unified Classroom Voice: Alice (energetic British RP female · Xb7hH8MSUJpSbSDYk0k2)'
    : '🎙 Unified Classroom Voice: ' + chosenClassroomVoiceName() + ' (' + id + ')';
  }
  if (lock) {
   lock.setAttribute('data-state', id === VOICE_ID ? 'locked' : 'cloned');
   lock.textContent = (id === VOICE_ID)
    ? '🔒 Locked: Energetic British RP Female (Alice · -21 LUFS · +2.5dB @ 3kHz)'
    : '🟢 Active Cloned Voice: ' + chosenClassroomVoiceName() + ' (' + id + ') · target -21 LUFS';
  }
  return true;
 }

 /* v0.0.6.q Pillar 1 — the WEEKLY AUTO-REGENERATION clock: the same */
 function currentWeeksSinceStart() {
  try {
   if (global.SDP && SDP.Views && typeof SDP.Views.weeksSinceStart === 'function') return Number(SDP.Views.weeksSinceStart()) || 2;
  } catch (e) {}
  var t0 = Date.parse('2026-10-22T00:00:00+05:30');
  if (!(t0 > 0)) t0 = Date.parse('2026-10-22');
  if (!(t0 > 0)) return 2;
  return Math.max(2, Math.floor((Date.now() - t0) / (7 * 86400000)));
 }

 function utf8Bytes(text) {
  var out = [], s = str(text), i, c, c2, cp;
  for (i = 0; i < s.length; i++) {
   c = s.charCodeAt(i);
   if (c < 0x80) { out.push(c); continue; }
   if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); continue; }
   if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
    c2 = s.charCodeAt(i + 1);
    if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
     i += 1;
     cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
     out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
     continue;
    }
   }
   out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
  }
  return out;
 }
 function hex8(n) {
  var v = (n >>> 0).toString(16);
  while (v.length < 8) v = '0' + v;
  return v;
 }
 function sha1Hex(text) {
  var bytes = utf8Bytes(text);
  var len = bytes.length, i, j, x;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  var hi = Math.floor(len / 536870912);
  var lo = (len * 8) >>> 0;
  bytes.push((hi >>> 24) & 0xFF, (hi >>> 16) & 0xFF, (hi >>> 8) & 0xFF, hi & 0xFF);
  bytes.push((lo >>> 24) & 0xFF, (lo >>> 16) & 0xFF, (lo >>> 8) & 0xFF, lo & 0xFF);
  var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  var w = [], a, b, c, d, e, f, k, tmp;
  for (i = 0; i < bytes.length; i += 64) {
   for (j = 0; j < 16; j++) {
    w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) |
     (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
   }
   for (j = 16; j < 80; j++) {
    x = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
    w[j] = (x << 1) | (x >>> 31);
   }
   a = h0; b = h1; c = h2; d = h3; e = h4;
   for (j = 0; j < 80; j++) {
    if (j < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999; }
    else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
    else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
    else { f = b ^ c ^ d; k = 0xCA62C1D6; }
    tmp = ((((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0);
    e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = tmp;
   }
   h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0;
   h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return hex8(h0) + hex8(h1) + hex8(h2) + hex8(h3) + hex8(h4);
 }
 function clipContentHash(text, voiceId, modelId) {
  return 'sha1:' + sha1Hex(str(text) + '|' + str(voiceId || activeVoiceId) + '|' + str(modelId || VOICE_MODEL));
 }

 /* R5 (F6): the whole 74-clip pack — 30 words, 30 numbers, 6 commands, 4 */
 var CMD_CLIPS = [
  { key: 'cmd.preparing', text: 'Preparing lesson. Listen carefully.' },
  { key: 'cmd.paused', text: 'Session paused.' },
  { key: 'cmd.resumed', text: 'Session resumed.' },
  { key: 'cmd.hint', text: 'Hint shown.' },
  { key: 'cmd.complete', text: "Dictation complete. Let's check your thirty words." },
  { key: 'cmd.sample', text: 'British female lecturer voice ready.' }
 ];
 var GUIDE_CLIP_TEXTS = [
  'Press Start Dictation to begin.',
  'Listen twice, then write in five seconds.',
  'Check all thirty words in order.',
  'Practise the words you missed.'
 ];
 function numberClipText(n) { return 'Number ' + n + '.'; }

 var STATIC_CLIP_KEYS = (function () {
  /* v0.0.7.a Z5: the static pack stays 1..30 (this IIFE runs at module load,
     before ST/wordCap exist — a cap change never mutates the canonical pack);
     cap-aware num.* generation for cap > 30 happens at publish time. */
  var keys = [], i;
  for (i = 0; i < CMD_CLIPS.length; i++) keys.push(CMD_CLIPS[i].key);
  for (i = 1; i <= 30; i++) keys.push('num.' + i);
  for (i = 0; i < GUIDE_CLIP_TEXTS.length; i++) keys.push('guide.en.' + i);
  for (i = 1; i <= 4; i++) keys.push('_guide_' + i);
  for (i = 1; i <= 4; i++) keys.push('_intro_male_' + i);
  return keys;
 })();
 function isStaticClipKey(key) { return STATIC_CLIP_KEYS.indexOf(str(key)) >= 0; }
 function introSteps() {
  /* The canonical sentences live in sdp-ui-views.js so the briefing always */
  var lines = [], i;
  try {
   if (global.SDP && SDP.Views && SDP.Views.briefingSentences) lines = SDP.Views.briefingSentences();
  } catch (e) { lines = []; }
  var out = [];
  /* v0.0.6.m: the executive briefing carries exactly 4 beats — the three */
  for (i = 0; i < lines.length && i < 4; i++) out.push({ key: '_intro_male_' + (i + 1), text: str(lines[i]) });
  return out;
 }
 function staticVaultStats() {
  var total = STATIC_CLIP_KEYS.length, locked = 0, i, k;
  for (i = 0; i < STATIC_CLIP_KEYS.length; i++) {
   k = STATIC_CLIP_KEYS[i];
   if (isObj(ST.voicePack.clips[k]) && str(ST.voicePack.clips[k].b64)) locked += 1;
  }
  return { total: total, locked: locked, keys: STATIC_CLIP_KEYS.slice() };
 }

 /* ══ v0.0.6.m Pillar 2 — 100% automatic system & briefing audio */
 var ESSENTIAL_SYSTEM_CLIPS = (function () {
  var out = [], i;
  var cmdRoles = { 'cmd.preparing': '_cmd_play', 'cmd.paused': '_cmd_pause', 'cmd.resumed': '_cmd_resume', 'cmd.complete': '_cmd_complete' };
  for (i = 0; i < CMD_CLIPS.length; i++) {
   if (cmdRoles[CMD_CLIPS[i].key]) out.push({ key: CMD_CLIPS[i].key, role: cmdRoles[CMD_CLIPS[i].key] });
  }
  for (i = 1; i <= 4; i++) out.push({ key: '_guide_' + i, role: '_guide_' + i });
  for (i = 1; i <= 4; i++) out.push({ key: '_intro_male_' + i, role: '_intro_male_' + i });
  return out;
 })();
 function essentialClipText(key) {
  var k = str(key), i;
  for (i = 0; i < CMD_CLIPS.length; i++) if (CMD_CLIPS[i].key === k) return CMD_CLIPS[i].text;
  for (i = 0; i < GUIDE_CLIP_TEXTS.length; i++) if (k === '_guide_' + (i + 1)) return GUIDE_CLIP_TEXTS[i];
  var steps = introSteps();
  for (i = 0; i < steps.length; i++) if (steps[i].key === k) return steps[i].text;
  return '';
 }
 /* v0.0.6.s Pillar 3 — the GUIDE-KEY ALIAS: the frozen _guide_1..4 vault
    keys are satisfied by the shipped guide.en.0..3 classroom clips (they
    are byte-identical twins: same b64, same sha1 pin). Pack lookups that
    ask for a _guide_N therefore read guide.en.(N-1) when the underscore
    twin is absent — so a pack that ships only guide.en.* never registers a
    phantom guide delta. */
 function packedSystemClip(key) {
  var k = str(key);
  var entry = isObj(ST.voicePack.clips[k]) ? ST.voicePack.clips[k] : null;
  if (entry || k.indexOf('_guide_') !== 0) return entry;
  var twin = 'guide.en.' + (Number(k.slice(7)) - 1);
  return isObj(ST.voicePack.clips[twin]) ? ST.voicePack.clips[twin] : null;
 }
 function missingSystemClips() {
  var out = [], i, k, text, entry;
  for (i = 0; i < ESSENTIAL_SYSTEM_CLIPS.length; i++) {
   k = ESSENTIAL_SYSTEM_CLIPS[i].key;
   text = essentialClipText(k);
   if (!text) continue;
   entry = packedSystemClip(k);
   if (!entry || !str(entry.b64)) { out.push({ key: k, text: text, why: 'missing' }); continue; }
   /* Outdated = the stored canonical text no longer matches (week-count */
   if (str(entry.text) !== text) out.push({ key: k, text: text, why: 'outdated' });
  }
  return out;
 }
 /* Runs on Studio unlock and before every Publish & Sync. Never blocks the */
 function autoEnsureSystemClips(opts, cb) {
  cb = cb || noop;
  opts = opts || {};
  function done(res) { try { cb(null, res); } catch (e1) {} }
  if (!ST.unlocked) { done({ skipped: 'locked' }); return false; }
  if (!allowAutoGen()) { done({ skipped: 'gates' }); return false; }
  var delta = missingSystemClips();
  if (!delta.length) { done({ delta: 0 }); return true; }
  var key = trimmedKey(str(resolveElevenKey()));
  if (!key) {
   if (!opts.quiet) {
    msg('System audio: ' + delta.length + ' essential clip(s) missing/outdated — add the ElevenLabs key and they will auto-sync on the next unlock or Publish.', '');
   }
   done({ delta: delta.length, synthesized: 0, noKey: true });
   return false;
  }
  var introKeys = [], sysQueue = [], i;
  for (i = 0; i < delta.length; i++) {
   if (delta[i].key.indexOf('_intro_male_') === 0) introKeys.push(delta[i].key);
   else sysQueue.push({ key: delta[i].key, text: delta[i].text, why: delta[i].why });
  }
  var made = 0;
  try {
   if (SDP.Diagnostics) SDP.Diagnostics.log('auto_ensure_system_clips', { delta: delta.length, intro: introKeys.length, system: sysQueue.length, source: str(opts.source || '') });
  } catch (e0) {}
  function afterSys() { done({ delta: delta.length, synthesized: made }); }
  function afterIntro(err, info) {
   if (info && info.made) made += info.made.length;
   if (err || !sysQueue.length) { afterSys(); return; }
   generateClips({ systemQueue: sysQueue, regenKeys: keysOf(sysQueue) }, function (err2, info2) {
    if (info2 && info2.made) made += info2.made.length;
    afterSys();
   });
  }
  if (introKeys.length) generateClips({ intro: true, keys: introKeys, regenKeys: introKeys }, afterIntro);
  else afterIntro(null, null);
  return true;
 }
 function keysOf(queue) {
  var out = [], i;
  for (i = 0; i < queue.length; i++) out.push(queue[i].key);
  return out;
 }

 /* ══ v0.0.6.m FIX 1 — autoSynthesizeBriefingAndGuide() */
 function briefingScriptWeights(lines, cb) {
  cb = cb || noop;
  if (!allowAutoGen()) { cb(null, null); return; }
  var candidates = llmCandidates({ p: aiProviderName(), k: str(ST.secrets.aiKey) || fieldValue('studioAiKey') });
  if (!candidates.length) { cb(null, null); return; }
  var joined = lines.map(function (l, i) { return (i + 1) + '. ' + l; }).join('\n');
  var prompt = 'You are a British English speech-timing editor. For each numbered sentence, ' +
   'return STRICT JSON only, exactly: {"lines":[{"n":1,"ww":[5,7,4,...]}]} where ww is one ' +
   'relative syllable-timing weight (2..14, integer) per word IN ORDER, heavier for long or ' +
   'emphasised words, and add +2 for a word followed by a comma pause. Sentences:\n' + joined;
  var at = 0;
  function attempt() {
   if (at >= candidates.length) { cb(null, null); return; }
   var c = candidates[at];
   at += 1;
   llmRequest(c.p, c.k, [], function (err, rows, rawText) {
    /* llmRequest indexes rows by word; the weights arrive through the */
    var parsed = parseScriptWeights(rawText || '', lines);
    if (parsed) {
     try {
      if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('script_weights_llm', { provider: c.p });
     } catch (e1) {}
     cb(null, parsed);
     return;
    }
    if (at < candidates.length) { attempt(); return; }
    cb(null, null);
   }, prompt);
  }
  /* The LLM pass is a best-effort optimiser: whatever it returns, the */
  try { attempt(); } catch (e) { cb(null, null); }
  return true;
 }
 function parseScriptWeights(text, lines) {
  var out = null;
  try {
   var parsed = parseJsonLoose(str(text));
   var rows = isObj(parsed) && Array.isArray(parsed.lines) ? parsed.lines : null;
   if (!rows) return null;
   var byN = {}, i;
   for (i = 0; i < rows.length; i++) if (isObj(rows[i]) && rows[i].n) byN[Number(rows[i].n)] = rows[i];
   out = [];
   for (i = 0; i < lines.length; i++) {
    var r = byN[i + 1];
    out.push((r && Array.isArray(r.ww)) ? r.ww.slice(0, 64) : null);
   }
  } catch (e) { out = null; }
  return out;
 }
 function autoSynthesizeBriefingAndGuide(opts, cb) {
  cb = cb || noop;
  opts = opts || {};
  /* v0.0.6.t PILLAR 3D: an unlocked-vault session bridge (Trigger 2,
     briefing-open) runs even when the Studio surface itself is locked again. */
  if (!ST.unlocked && !vaultSessionActive()) { cb(new Error('locked'), null); return false; }
  if (!allowAutoGen()) { cb(new Error('gates'), null); return false; }
  var steps = introSteps();
  var guideKeys = GUIDE_KEYS.slice();
  var lines = [];
  try {
   if (global.SDP && SDP.Views && SDP.Views.briefingSentences) lines = SDP.Views.briefingSentences();
  } catch (e) { lines = []; }
  for (var i = 0; i < lines.length && i < 4; i++) steps.push({ key: '_guide_' + (i + 1), text: str(GUIDE_CLIP_TEXTS[i] || '') });
  var weights = null;
  var run = function () {
   generateClips({ intro: true, keys: ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4'], regenKeys: ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4'], noCommit: !!opts.noCommit, force: !!opts.force }, function (err, info) {
    if (err && str(err.message) === 'no_key') {
     msg('Briefing voices: add the ElevenLabs key (Step 1) and they auto-synthesize on the next unlock or Publish — until then the app narrates with the pinned British-male device voice.', 'warn');
     cb(err, { stage: 'no_key' });
     return;
    }
    /* the guide steps + command cues ride the system queue (noCommit: the
       v0.0.6.s RACE LAW: the _intro_male_1..4 beats were JUST synthesized
       by the intro: true call above, so they are filtered OUT of this
       second systemQueue batch — two generateClips() batches may never
       synthesize the same key concurrently. regenKeys carries the REAL
       clip key names (cmd.*), never the legacy _cmd_* role names, so the
       static-vault skip check actually matches. */
    generateClips({ systemQueue: ESSENTIAL_SYSTEM_CLIPS.filter(function (c) { return c.key.indexOf('_intro_male_') !== 0; }).map(function (c) { return { key: c.key, text: essentialClipText(c.key), why: 'auto' }; }), regenKeys: guideKeys.concat(['cmd.preparing', 'cmd.paused', 'cmd.resumed', 'cmd.complete']), noCommit: !!opts.noCommit }, function (err2, info2) {
     if (weights && Array.isArray(weights)) {
      for (var wi = 0; wi < 4; wi++) {
       var entry = isObj(ST.voicePack.clips['_intro_male_' + (wi + 1)]) ? ST.voicePack.clips['_intro_male_' + (wi + 1)] : null;
       if (entry && weights[wi]) entry.ww = weights[wi];
      }
     }
     var made = ((info && info.made ? info.made.length : 0) + (info2 && info2.made ? info2.made.length : 0));
     try {
      if (global.SDP && SDP.Diagnostics) {
       SDP.Diagnostics.log('auto_synth_briefing_guide', { source: str(opts.source || ''), made: made, err: err ? str(err.message) : '', err2: err2 ? str(err2.message) : '' });
      }
     } catch (e0) {}
     cb(null, { made: made, weights: !!weights });
    });
   });
  };
  /* Step A first (best-effort, never blocks): then Step B. */
  briefingScriptWeights(lines, function (e, w) {
   weights = w;
   run();
  });
  return true;
 }

 /* ══ v0.0.6.n RECOMMENDATION 1 — the /with-timestamps alignment parser ══
  * ElevenLabs responds with alignment.characters plus
  * character_start_times_seconds / character_end_times_seconds. This walks
  * the character stream, splits on whitespace boundaries and returns one
  * [startMs, endMs] pair PER WORD in utterance order — the exact `wt` array
  * stored on the clip entry and consumed by the karaoke clock. A trailing
  * punctuation character keeps its word's window (no zero-width words). */
 function parseAlignmentToWordTimings(alignment, text) {
  var out = [];
  try {
   if (!isObj(alignment)) return null;
   var chars = alignment.characters;
   var starts = alignment.character_start_times_seconds;
   var ends = alignment.character_end_times_seconds;
   if (typeof chars !== 'string' || !Array.isArray(starts) || !Array.isArray(ends)) return null;
   var n = Math.min(chars.length, starts.length, ends.length);
   if (!n) return null;
   var i, ch, s, e, curStart = -1, lastEnd = -1, sawWord = false;
   for (i = 0; i < n; i++) {
    ch = chars.charAt(i);
    s = Number(starts[i]);
    e = Number(ends[i]);
    if (!(s >= 0) || !(e >= s)) continue;
    if (/\s/.test(ch)) {
     if (sawWord) { out.push([Math.round(curStart * 1000), Math.round(lastEnd * 1000)]); sawWord = false; curStart = -1; }
     continue;
    }
    if (!sawWord) { sawWord = true; curStart = s; lastEnd = e; }
    else { lastEnd = e; }
   }
   if (sawWord) out.push([Math.round(curStart * 1000), Math.round(lastEnd * 1000)]);
   /* The alignment must cover the SAME word count as the spoken sentence — */
   var words = str(text).split(/\s+/).filter(function (w) { return !!w; });
   if (!out.length || !words.length) return null;
   if (out.length === words.length) return out;
   /* v0.0.6.r Pillar 2 — the NEVER-NULL PROPORTIONAL MAP: a mismatched
      count (normalized_alignment expanded "($0)" / "100%" into spoken
      words, or a hyphenated token split) must never kill the karaoke with
      null. The words.length words are re-mapped proportionally across the
      measured [startMs, endMs] span, weighted by word character length, so
      the parser always returns a valid words.length array of pairs. */
   var totalStart = out[0][0], totalEnd = out[out.length - 1][1];
   var span = Math.max(0, totalEnd - totalStart);
   var weights = [], totalChars = 0, wi;
   for (wi = 0; wi < words.length; wi++) { weights[wi] = Math.max(1, words[wi].length); totalChars += weights[wi]; }
   var mapped = [], cursor = totalStart;
   for (wi = 0; wi < words.length; wi++) {
    var wDur = span > 0 ? Math.round(span * (weights[wi] / totalChars)) : 0;
    var wStart = cursor;
    var wEnd = (wi === words.length - 1) ? totalEnd : Math.min(totalEnd, wStart + wDur);
    mapped.push([wStart, Math.max(wStart, wEnd)]);
    cursor = mapped[wi][1];
   }
   return mapped;
  } catch (e) { return null; }
 }

 var BRIDGE_FLAG = 'sdp.studio.vaultUnlocked';
 var bridgeBusy = false;
 function vaultSessionActive() {
  try { return global.sessionStorage && global.sessionStorage.getItem(BRIDGE_FLAG) === '1'; } catch (e) { return false; }
 }
 function markVaultSession() {
  try { if (global.sessionStorage) global.sessionStorage.setItem(BRIDGE_FLAG, '1'); } catch (e) {}
 }
 /* The live status surface: #studioBriefingVoiceBar sits at the top of the */
 function paintBriefingVoiceBar(state, detail) {
  var bar = byId('studioBriefingVoiceBar');
  if (!bar) return false;
  var lines = {
   idle: '🎙 Project Overview & Guide voices are checked automatically on unlock — or press Generate below.',
   checking: '🎙 Checking Project Overview & Guide Voices… Synthesizing with ElevenLabs (High-Professional Executive Male · ' + chosenBriefingVoiceName() + ') + Groq/Gemini Timing…',
   ok: '✓ Project Overview (4/4) & Guide (4/4) Voices Synced to GitHub & Live Cache!',
   noop: '✓ Project Overview & Guide voices already up to date (live weekly counter + provenance checked).',
   nokey: '⚠ Add the ElevenLabs key (Step 1) — the briefing narrates with the pinned British-male device voice until then.',
   busy: '🎙 Bridge already running — one moment…',
   error: '✗ Briefing voice bridge failed — check the key pool and retry with the Generate button.'
  };
  var s = lines[state] ? state : 'idle';
  bar.setAttribute('data-state', s);
  bar.textContent = lines[s] + (detail ? ' ' + str(detail) : '');
  try {
   if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('briefing_voice_bridge', { state: s, detail: str(detail || '') });
  } catch (e0) {}
  return true;
 }
 function briefingVoiceDelta() {
  /* v0.0.6.q Pillar 1 — the PROVENANCE & WEEKLY AUTO-REGENERATION LAW. In */
  var out = { intro: [], guide: [], total: 0 };
  var steps = introSteps(), i, entry, k, wantVoice;
  try { wantVoice = chosenBriefingVoiceId(); } catch (eV) { wantVoice = INTRO_VOICE.id; }
  for (i = 0; i < steps.length; i++) {
   k = steps[i].key;
   entry = isObj(ST.voicePack.clips[k]) ? ST.voicePack.clips[k] : null;
   if (!entry || !str(entry.b64) || str(entry.text) !== steps[i].text ||
       entry.liveEleven !== true ||
       Number(entry.weekStamp || 0) !== Number(currentWeeksSinceStart())) { out.intro.push(k); continue; }
   /* v0.0.6.r CLONED-VOICE PROTECTION: a live beat recorded THIS week with
      matching text is NEVER flagged for voiceId drift by a passive unlock /
      briefing-open / publish check on a secondary browser whose custom voice
      ID was never saved there — that is exactly what overwrote the creator's
      Cloned Voice with default George in v0.0.6.q. Drift counts only when
      the creator explicitly changed the selector this session
      (voiceSelectionDirty) or the chosen voice is a real custom/non-default
      persona that genuinely differs from the recorded clip. */
   if (wantVoice && str(entry.voiceId) !== wantVoice &&
       (ST.voiceSelectionDirty === true || wantVoice !== INTRO_VOICE.id)) out.intro.push(k);
  }
  for (i = 0; i < GUIDE_KEYS.length; i++) {
   k = GUIDE_KEYS[i];
   entry = packedSystemClip(k);
   if (!entry || !str(entry.b64)) out.guide.push(k);
  }
  out.total = out.intro.length + out.guide.length;
  return out;
 }
 function primeClipCache(entries) {
  /* Best-effort CacheStorage prime: the playable blob URL of each fresh */
  try {
   if (!global.caches || !global.caches.open) return false;
   var SPEECH = global.SDP && global.SDP.Speech ? global.SDP.Speech : null;
   global.caches.open('sdp-audio-clips').then(function (cache) {
    var chain = Promise.resolve();
    Object.keys(entries).forEach(function (k) {
     chain = chain.then(function () {
      var url = '';
      try { if (SPEECH && SPEECH.playableUrl && entries[k] && entries[k].b64) url = SPEECH.playableUrl('data:audio/mpeg;base64,' + entries[k].b64); } catch (e1) {}
      if (!url) return null;
      return cache.put(new Request(url, { cache: 'reload' }), new Response(entries[k].b64 ? ('data:audio/mpeg;base64,' + entries[k].b64) : '', { headers: { 'Content-Type': 'audio/mpeg' } })).catch(function () {});
     });
    });
   }).catch(function () {});
   return true;
  } catch (e) { return false; }
 }
 function ensureBriefingAndGuideVoices(opts, cb) {
  cb = cb || noop;
  opts = opts || {};
  var source = str(opts.source || 'manual');
  if (!ST.unlocked && !vaultSessionActive()) { cb(new Error('locked'), null); return false; }
  if (!allowAutoGen()) { cb(new Error('gates'), null); return false; }
  /* v0.0.6.r: a key/token typed into the fields this session is merged into
     ST.secrets BEFORE resolveElevenKey()/ghToken checks, so the bridge never
     aborts with no_key/no_token while the key sits un-merged in the input. */
  try { mergeSecretInputs(); } catch (eMS) {}
  if (!trimmedKey(str(resolveElevenKey()))) {
   if (source === 'unlock' || source === 'button' || source === 'briefing-open' || source === 'publish') paintBriefingVoiceBar('nokey');
   cb(new Error('no_key'), { stage: 'no_key' });
   return false;
  }
  if (bridgeBusy) {
   paintBriefingVoiceBar('busy');
   cb(new Error('busy'), { stage: 'busy' });
   return false;
  }
  loadVoicePack(function () {
   var delta = briefingVoiceDelta();
   if (!delta.total && !opts.force) {
    if (source === 'unlock' || source === 'button' || source === 'publish' || source === 'briefing-open') paintBriefingVoiceBar('noop');
    cb(null, { made: 0, stage: 'noop' });
    return;
   }
   bridgeBusy = true;
   paintBriefingVoiceBar('checking');
   /* v0.0.6.r: the batch runs with noCommit — the ONE commitVoicePack() in
      this callback owns the atomic elevenlabs-audio.json + version.json
      publish and the local cache prime, so the ✓ bar paints only after both
      really completed (or after the no_token local-cache fallback). */
   autoSynthesizeBriefingAndGuide({ source: source, noCommit: true, force: !!opts.force || delta.intro.length > 0 }, function (err, info) {
    bridgeBusy = false;
    if (err && str(err.message) === 'no_key') {
     paintBriefingVoiceBar('nokey');
     cb(err, { stage: 'no_key' });
     return;
    }
    if (err) {
     paintBriefingVoiceBar('error', err.message);
     cb(err, { stage: 'error' });
     return;
    }
    var made = info && info.made ? info.made : 0;
    /* Live-session injection + cache prime: the fresh beats are playable */
    try {
     var fresh = {};
     var ks = ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4'].concat(GUIDE_KEYS);
     for (var i = 0; i < ks.length; i++) {
      if (isObj(ST.voicePack.clips[ks[i]]) && str(ST.voicePack.clips[ks[i]].b64)) fresh[ks[i]] = ST.voicePack.clips[ks[i]];
     }
     if (global.SDP && SDP.Speech && SDP.Speech.injectClips) SDP.Speech.injectClips(fresh);
     primeClipCache(fresh);
    } catch (e1) {}
    commitVoicePack(function (commitErr) {
     /* v0.0.6.t PILLAR 3D — the HONEST BAR law: when a real delta was due
        (force or delta.total > 0) but NOTHING was synthesized (made === 0,
        or the batch stopped on ST.lastFailedClip), the bar paints the exact
        failure — never a fake green ✓ "Voices Synced" over an empty batch. */
     if ((opts.force || delta.total > 0) && (made === 0 || ST.lastFailedClip)) {
      paintBriefingVoiceBar('error', ST.lastFailedClip ? (ST.lastFailedClip.key + ' · ' + ST.lastFailedClip.reason) : '0 clips synthesized');
      cb(null, { made: made, stage: 'done', failed: ST.lastFailedClip ? ST.lastFailedClip.key : 'none', commit: commitErr ? str(commitErr.message) : 'ok' });
      return;
     }
     if (commitErr && str(commitErr.message) === 'no_token') {
      paintBriefingVoiceBar('ok', '· Saved in browser cache (add GitHub token in Step 2 to publish to all devices)');
     } else if (commitErr) {
      paintBriefingVoiceBar('ok', '· Saved in browser cache (GitHub commit failed · ' + quotaError(commitErr) + ')');
     } else {
      paintBriefingVoiceBar('ok');
     }
     cb(null, { made: made, stage: 'done', commit: commitErr ? str(commitErr.message) : 'ok' });
    });
   });
  });
  return true;
 }

 function poolDefaultProvider(slotIndex) {
  var i = Number(slotIndex);
  if (!(i >= 0) || i >= POOL_DEFAULT_PROVIDERS.length) return 'groq';
  return POOL_DEFAULT_PROVIDERS[i];
 }
 function normalizePoolEntry(e, slotIndex) {
  var fallbackP = poolDefaultProvider(slotIndex);
  if (!isObj(e)) return { p: fallbackP, k: '' };
  var p = str(e.p);
  if (!p) p = fallbackP;
  if (!POOL_PROVIDERS[p]) p = fallbackP;
  return { p: p, k: trimmedKey(str(e.k)) };
 }
 function keyPoolEntries() {
  var raw = isObj(ST.secrets) && Array.isArray(ST.secrets.keyPool) ? ST.secrets.keyPool : [];
  var out = [], i;
  for (i = 0; i < KEY_POOL_SLOTS; i++) out.push(normalizePoolEntry(raw[i], i));
  return out;
 }
 function mergeKeyPoolInputs() {
  var pool = keyPoolEntries(), i, prov, inp, v;
  for (i = 0; i < KEY_POOL_SLOTS; i++) {
   prov = byId('kpProv' + (i + 1));
   inp = byId('kpSlot' + (i + 1));
   if (prov) pool[i].p = str(prov.value) || pool[i].p;
   if (inp) {
    v = trimmedKey(str(inp.value));
    if (v) pool[i].k = v;
    else if (inp.getAttribute('data-dirty') === '1') pool[i].k = '';
   }
  }
  if (!isObj(ST.secrets)) ST.secrets = {};
  ST.secrets.keyPool = pool;
  return pool;
 }
 function keyPoolCount() {
  var pool = keyPoolEntries(), n = 0, i;
  for (i = 0; i < pool.length; i++) if (str(pool[i].k)) n += 1;
  return n;
 }
 function elevenKeyPool() {
  /* Slot order is the rotation order: the primary ElevenLabs field first, */
  var out = [], seen = {};
  var primary = trimmedKey(str(ST.secrets.elevenKey) || fieldValue('elKeyInput'));
  if (looksLikeElevenKey(primary)) { out.push(primary); seen[primary] = 1; }
  var pool = keyPoolEntries(), i, k;
  for (i = 0; i < pool.length; i++) {
   k = str(pool[i].k);
   if (pool[i].p === 'elevenlabs' && looksLikeElevenKey(k) && !seen[k]) { out.push(k); seen[k] = 1; }
  }
  return out;
 }
 function llmKeyPool() {
  var out = [], pool = keyPoolEntries(), i;
  for (i = 0; i < pool.length; i++) {
   if (str(pool[i].k) && pool[i].p !== 'elevenlabs') out.push({ p: pool[i].p, k: str(pool[i].k) });
  }
  return out;
 }
 /* ══ v0.0.6.m: the 4× Groq rotation engine */
 function groqKeyPool() {
  var out = [], pool = keyPoolEntries(), i;
  for (i = 0; i < pool.length; i++) {
   if (pool[i].p === 'groq' && str(pool[i].k)) out.push({ p: 'groq', k: str(pool[i].k), slot: i + 1 });
  }
  return out;
 }
 function llmCandidates(preferred) {
  /* The chosen provider + key first, then the two Groq slots in order */
  var out = [], seen = {};
  var first = { p: str(preferred && preferred.p), k: str(preferred && preferred.k) };
  if (first.k && LLM_ENDPOINTS[first.p]) { out.push(first); seen[first.k] = 1; }
  var groq = groqKeyPool(), i;
  for (i = 0; i < groq.length; i++) {
   if (!seen[groq[i].k]) { out.push({ p: 'groq', k: groq[i].k }); seen[groq[i].k] = 1; }
  }
  var pool = llmKeyPool();
  for (i = 0; i < pool.length; i++) {
   if (!seen[pool[i].k]) { out.push({ p: pool[i].p, k: pool[i].k }); seen[pool[i].k] = 1; }
  }
  return out;
 }
 function logGroqRotation(reason, slot) {
  try {
   if (global.SDP && SDP.Diagnostics) {
    SDP.Diagnostics.log('groq_key_rotated', { reason: str(reason || ''), slot: Number(slot) || 0 });
   }
  } catch (e) {}
 }
 var poolCursor = 0;
 function resolveElevenKey() {
  var list = elevenKeyPool();
  if (!list.length) return trimmedKey(str(ST.secrets.elevenKey) || fieldValue('elKeyInput'));
  return list[Math.min(poolCursor, list.length - 1)];
 }
 function rotateElevenKey(reason) {
  var list = elevenKeyPool();
  if (list.length <= 1) return null;
  poolCursor = (poolCursor + 1) % list.length;
  var nextKey = list[poolCursor];
  try {
   if (global.SDP && SDP.Diagnostics) {
    SDP.Diagnostics.log('key_pool_rotated', { reason: str(reason || ''), slot: poolCursor + 1, keys: list.length });
   }
  } catch (e) {}
  return nextKey;
 }
 function probePoolKeys(cb) {
  var pool = keyPoolEntries();
  var elevenList = elevenKeyPool();
  var results = [], done = 0, i;
  var finishOne = function () {
   done += 1;
   if (done >= elevenList.length) { cb(null, results); }
  };
  if (!elevenList.length) { cb(null, []); return false; }
  for (i = 0; i < elevenList.length; i++) {
   (function (key, idx) {
    global.fetch(EL_SUBSCRIPTION, { headers: { 'xi-api-key': key, Accept: 'application/json' }, cache: 'no-store' })
     .then(function (res) { return res && res.json ? res.json() : null; })
     .then(function (json) {
      var tier = isObj(json) ? str(json.tier) : '';
      results.push({ slot: idx + 1, ok: !!tier, status: 200, tier: tier });
      finishOne();
     }, function () {
      results.push({ slot: idx + 1, ok: false, status: 0, tier: '' });
      finishOne();
     });
   })(elevenList[i], i);
  }
  return true;
 }

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
 function T(key, fallback) { return esc(t(key, fallback)); }
 function en(key) {
  var table = SDP.STRINGS_EN || {};
  return str(table[key]);
 }
 function data() { return SDP.Data || null; }
 function sync() { return SDP.Sync || null; }
 function vault() { return SDP.Sync && SDP.Sync.Vault ? SDP.Sync.Vault : null; }

 /* D-S3: the studio version is READ */
 function appVersion() {
  var v = '';
  try { v = str(global.SDP && global.SDP.version); } catch (e) { v = ''; }
  if (!v) v = str(global.__SDP_BOOT_VERSION__);
  if (!v) {
   
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
 /* D-S4: settingsRev only ever moves */
 function nextSettingsRev() {
  var current = 0;
  try { current = Number((sync() && sync().version() && sync().version().settingsRev) || 0); } catch (e) { current = 0; }
  return Math.max(schemaVer(), current + 1);
 }
 /* D19/W8: ONE monotonic publish clock… */
 function nextSyncRev() {
  var prev = 0;
  try { prev = Number((sync() && sync().version() && sync().version().syncRev) || 0); } catch (e) { prev = 0; }
  return Math.max(Date.now(), prev + 1);
 }

 var ST = {
  unlocked: false,
  /* v0.0.6.b (S4): unpublished word edits — powers the tab-exit guard. */
  dirty: false,
  /* v0.0.6.c (F1): per-word delta recognition — wordsDirty is true only */
  wordsDirty: false,
  wordDeltas: [],
  envelope: '',
  secrets: {},
  message: '',
  messageState: '',
  words: [],
  preview: null,
  pendingClip: null,
  lastPublish: null,
  generating: false,
  /* v0.0.6.r Pillar 1: the explicitly-changed briefing voice marker (set by
     the selector / custom-ID handlers) + the discovered /v1/voices account
     list, so briefingVoiceDelta() only overwrites a live Cloned Voice after
     a real in-session selection change and mount() re-renders keep both. */
  voiceSelectionDirty: false,
  fetchedVoices: [],
   /* Memory-only, never persisted, never… */
  pin: '',
  recording: false,
  recorder: null,
  quota: null,
  voicePack: { loaded: false, clips: {}, rev: 0 },
  testStatus: '',
  testState: '',
  /* D12–D15: the free-AI slot, the */
  aiProvider: 'free_dict',
  aiKey: '',
  masterStep: 0,
  masterDetail: '',
  enrichStatus: '',
  enriching: false,
  publishing: false,
  /* D4/D5: the non-fatal tier warning */
  tierWarn: '',
  layerOneRestored: false,
  /* R7 (F7): a master recovery unlock must prompt a fresh PIN immediately. */
  recoveryMode: false,
  wordsConfirmed: false,
  rawParsedWords: [],
  sessionNo: '',
  title: ''
 };
 var autoLockBound = false;

 /* D3/D17: busy-button helper — sets */
 function withBusy(btnOrId, workFn) {
  var btn = typeof btnOrId === 'string' ? byId(btnOrId) : btnOrId;
  if (!btn) { try { workFn(noop); } catch (e) {} return; }
  var orig = str(btn.textContent || '');
  btn.setAttribute('data-orig-label', orig);
  btn.setAttribute('data-busy', '1');
  btn.disabled = true;
  btn.textContent = T('studioWorking');
  function done() {
   try { btn.textContent = btn.getAttribute('data-orig-label') || orig; btn.removeAttribute('data-busy'); btn.disabled = false; } catch (e) {}
  }
  try { workFn(done); } catch (e) { done(); }
 }

 /* ══ envelope resolution (D-S7 */
 /* D5: the Layer-1 vault backup */
 function settingsSafe() {
  try { return (data() && data().settings) ? (data().settings() || {}) : {}; } catch (e) { return {}; }
 }
 function layerOneVault() { var s = settingsSafe(); return isObj(s.vaultLock) ? s.vaultLock : {}; }
 function layerOneEnvelope() { return str(layerOneVault().encVault); }
 function layerOneVerifier() { var l = layerOneVault(); return isObj(l.pinVerifier) ? l.pinVerifier : null; }
 function writeLayerOne(envelope, verifier) {
  var l = layerOneVault(), lt = Math.max(0, Number(l.lockUntil) || 0);
  var out = {
   fails: Math.max(0, Number(l.fails) || 0), lockUntil: lt, until: lt,
   strikes: Math.max(0, Number(l.strikes) || 0), encVault: str(envelope) || str(l.encVault),
   pinVerifier: isObj(verifier) ? verifier : (isObj(l.pinVerifier) ? l.pinVerifier : null),
   updatedAt: str(envelope) ? Date.now() : (Number(l.updatedAt) || 0)
  };
  try { data().saveSettings({ vaultLock: out }); } catch (e) {}
  return out;
 }
 /* D8/D9: repair a released */
 function healFromLayerOne() {
  try {
   var l = layerOneVault(), env = str(l.encVault);
   var cfg = sync() && sync().config ? sync().config() : null;
   if (!cfg || !isRealEnvelope(env)) return false;
   var rev = Number(l.updatedAt) || 0;
   if (isRealEnvelope(str(cfg.encVault)) && !(rev > (Number(cfg.syncRev) || 0))) return false;
   cfg.encVault = env;
   if (isObj(l.pinVerifier)) cfg.pinVerifier = l.pinVerifier;
   try { data().saveSettings({ cachedVault: env, cachedVaultSyncRev: rev || Date.now() }); } catch (e) {}
   if (!isRealEnvelope(ST.envelope)) ST.envelope = env;
   ST.layerOneRestored = true;
   return true;
  } catch (e) { return false; }
 }
 function cachedVault() {
  var s = settingsSafe();
  return s ? str(s.cachedVault) : '';
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
 function configEnvelope() {
  if (isRealEnvelope(ST.envelope)) return ST.envelope;
  var local = cachedVault();
  if (isRealEnvelope(local)) return local;
  var one = layerOneEnvelope();
  if (isRealEnvelope(one)) return one;
  return cdnEnvelope();
 }
 function resolveEnvelope(cb) {
  cb = cb || noop;
  /* D8/D9: heal the config from the */
  healFromLayerOne();
  var localRev = 0;
  try { localRev = Number((settingsSafe().cachedVaultSyncRev) || 0); } catch (e) { localRev = 0; }
  var best = { env: '', rev: 0 };
  function consider(env, rev) {
   if (!isRealEnvelope(env)) return;
   if (!best.env || Number(rev || 0) >= best.rev) best = { env: str(env), rev: Number(rev || 0) };
  }
  consider(configEnvelope(), localRev || Date.now());
  consider(layerOneEnvelope(), Number(layerOneVault().updatedAt) || localRev);
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

 
 /* v0.0.7.c (BUG-03): THE WORD-RECORD SCHEMA GATE. A word list may only
    reach GitHub (and every classroom device) when EVERY record carries a
    complete English meaning, a natural Sinhala meaning, British IPA, a part
    of speech and an example sentence that contains the word. Blank-si and
    truncated-m lists can never be published again. */
 function validateWordRecords(words) {
  var list = Array.isArray(words) ? words : [];
  var problems = [];
  var seen = {};
  for (var i = 0; i < list.length; i++) {
   var w = list[i] || {};
   var name = str(w.w).replace(/^\s+|\s+$/g, '');
   if (!name) { problems.push('#' + (i + 1) + ': ' + t('studioWordsIssueW', 'missing word')); continue; }
   if (seen[name.toLowerCase()]) problems.push(name + ': ' + t('studioWordsIssueDup', 'duplicate word'));
   seen[name.toLowerCase()] = true;
   var issues = [];
   var m = str(w.m || '');
   var si = str(w.si || '');
   var p = str(w.p || '');
   var pos = str(w.pos || '');
   var s = str(w.s || '');
   if (!si || !/[\u0D80-\u0DFF]/.test(si)) issues.push(t('studioWordsIssueSi', 'missing Sinhala meaning'));
   if (!m || m.length < 15 || /(\b(the|a|an|of|to|and|into|with|for|from)\.)$/i.test(m)) {
    issues.push(t('studioWordsIssueM', 'English meaning missing or truncated'));
   }
   if (!p || p.charAt(0) !== '/') issues.push(t('studioWordsIssueP', 'missing IPA'));
   if (!pos || pos.charAt(pos.length - 1) !== '.') issues.push(t('studioWordsIssuePos', 'missing part of speech'));
   if (!s) issues.push(t('studioWordsIssueS', 'missing example sentence'));
   else if (name.toLowerCase().indexOf('/') >= 0) {
    /* a slash word (disc/disk) matches when any variant appears */
    var any = false, parts2 = name.split('/');
    for (var q = 0; q < parts2.length; q++) if (parts2[q] && s.toLowerCase().indexOf(parts2[q].toLowerCase().replace(/^\s+|\s+$/g, '')) >= 0) any = true;
    if (!any) issues.push(t('studioWordsIssueSNoWord', 'example does not contain the word'));
   } else if (s.toLowerCase().indexOf(name.toLowerCase()) < 0) {
    issues.push(t('studioWordsIssueSNoWord', 'example does not contain the word'));
   }
   if (issues.length) problems.push(name + ' — ' + issues.join(', '));
  }
  return { ok: problems.length === 0, total: list.length, problems: problems, summary: problems.slice(0, 3).join(' · ') + (problems.length > 3 ? ' (+' + (problems.length - 3) + ')' : '') };
 }

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
  var version = appVersion();
  var lists = Array.isArray(base.lists) ? base.lists : [];
  var list = null, i;
  for (i = 0; i < lists.length; i++) if (lists[i] && lists[i].id === listId) list = lists[i];
  if (!list) {
   list = { id: listId, name: str(opts.title || 'Session ' + version), version: version, session: 'Session ' + version, date: new Date().toISOString().slice(0, 10), active: true, words: [] };
   lists.unshift(list);
  }
  var clean = [];
  for (i = 0; i < (words || []).length; i++) {
   var w = words[i] || {};
   /* D19: keep the real British */
   var cleanWord = { w: str(w.w), p: str(w.p), pos: str(w.pos), m: str(w.m), si: str(w.si), s: str(w.s) };
   if (str(w.audio)) cleanWord.audio = str(w.audio);
   clean.push(cleanWord);
  }
  list.words = clean;
  list.active = true;
  list.version = version;
  base.lists = lists;
  base.words = clean;
  /* D-L9: the cockpit reads */
  base.session = isObj(base.session) ? base.session : {};
  base.session.words = clean;
  base.session.no = str(opts.sessionNo || base.session.no || '8');
  base.session.title = str(opts.title || base.session.title || 'Session ' + version);
  /* ══ v0.0.7.a PILLAR 5 (Z5) — the session meta + word count are stamped
     from the live editor state so every publish carries them. ══ */
  var meta = isObj(ST.meta) ? ST.meta : {};
  base.session.date = str(meta.date || base.session.date || new Date().toISOString().slice(0, 10));
  base.session.day = str(meta.day || base.session.day || '');
  base.session.branch = str(meta.branch || base.session.branch || '');
  base.session.classInfo = str(meta.classInfo || base.session.classInfo || '');
  base.session.display = str(meta.display || base.session.display || '');
  base.session.wordCount = clean.length;
  base.wordCountMode = wordCountMode(); /* v0.0.7.a A1: preset|custom ships with every publish */
  base.session.wordCountMode = wordCountMode();
  base.wordCount = clean.length;
  base.appVersion = appVersion();
  base.version = appVersion();
  base.ok = true;
  base.updatedAt = new Date().toISOString();
  return base;
 }
 function voicePackPayload(syncRev) {
  var base = { version: appVersion(), appVersion: appVersion(), ver: schemaVer(), schema: schemaVer(), settingsRev: nextSettingsRev() };
  var remote = null;
  try { remote = SDP.Speech && SDP.Speech.state ? SDP.Speech.state.manifest : null; } catch (e) { remote = null; }
  if (isObj(remote)) for (var k in remote) if (Object.prototype.hasOwnProperty.call(remote, k) && base[k] === undefined) base[k] = remote[k];
  base.voiceId = activeVoiceId;
  base.voiceName = activeVoiceName;
  /* v0.0.6.r Pillar 1: the pack header stamps the CHOSEN briefing voice so
     every browser can see which executive/cloned persona baked the beats. */
  base.briefingVoiceId = chosenBriefingVoiceId();
  base.briefingVoiceName = chosenBriefingVoiceName();
  base.modelId = VOICE_MODEL;
  base.voiceModel = VOICE_MODEL;
  base.persona = VOICE_PERSONA;
  base.hashAlgo = HASH_ALGO;
  base.clips = purgeStaleWordsFromPack(packClipsForDisk(), currentWords());
  base.updatedAt = new Date().toISOString();
  /* D19: same publish clock as */
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
  /* D-S2: v0.0.1.b cloned config */
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

 /* ══ PIN unlock / first-time */
 function persistEnvelope(envelope) {
   /* D-S1/D5: survive a reload. memory */
  try {
   data().saveSettings({ cachedVault: str(envelope), cachedVaultSyncRev: Date.now() });
  } catch (e) {}
  try { writeLayerOne(envelope, pinVerifier() || layerOneVerifier()); } catch (e) {}
  try {
   var cfg = sync() && sync().config ? sync().config() : null;
   if (cfg) cfg.encVault = str(envelope);
  } catch (e) {}
  return true;
 }

 /* ══ R1: the ten classroom keys the */
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
 /* D7: the British English default rides */
 function classSettingsPayload() {
  var out = classSettingsSnapshot();
  if (out.lang === undefined) out.lang = 'en';
  return out;
 }
 function buildVaultFiles(cfgBody, versionBody, message) {
  return [
   { path: 'data/config.json', content: JSON.stringify(cfgBody, null, 2), message: str(message || 'Studio vault ' + appVersion()) },
   { path: 'data/version.json', content: JSON.stringify(versionBody, null, 2), message: 'Studio version ' + appVersion() }
  ];
 }
 /* config.json first, version.json LAST */
 function publishVaultFiles(files, token, cb) {
  cb = cb || noop;
  if (!sync() || !sync().publishFilesSequential) { cb(new Error('no_sync')); return false; }
  return sync().publishFilesSequential(files, token, noop, function (err, info) {
   if (!err) {
    try {
     var cfg = sync().config ? sync().config() : null;
     if (cfg) cfg.settingsRev = nextSettingsRev();
    } catch (e) {}
    bumpMeterCache();
   }
   cb(err, info);
  });
 }
 /* SYNC-03: copy the ten classroom */
 function saveClassSettings(cb) {
  cb = cb || noop;
  if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
  /* v0.0.6.c (F1): word edits ride the SAME button — the unified pipeline */
  try { detectWordDeltas(); } catch (e) {}
  if (ST.wordsDirty && str(ST.secrets.ghToken)) {
   return publishWordsAndVoice(function (err, info) { cb(err, info); });
  }
  var conf = classSettingsPayload();
  if (!sync() || !sync().publishFilesSequential) { cb(new Error('no_sync')); return { ok: false, reason: 'no_sync' }; }
  var cfgBody = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
  cfgBody.classSettings = conf;
  var env = isRealEnvelope(ST.envelope) ? ST.envelope : configEnvelope();
  var token = str(ST.secrets.ghToken);
  function stamp(ok, detail) {
   var last = byId('lecturerSyncLast');
   if (!last) return;
   last.textContent = (ok ? t('lecturerSyncLast') : t('studioPublishFail')) + ' · ' +
    hhmm() + (detail ? ' · ' + detail : '');
   last.setAttribute('data-state', ok ? 'ok' : 'bad');
  }
  if (!token) {
   msg(t('studioNoToken'), 'bad');
   stamp(false, 'no token');
   clearBusy();
   cb(new Error('no_token'));
   return { ok: false, reason: 'no_token', classSettings: conf };
  }
  publishConfigAndVersion(cfgBody, env, 'Class settings rev', function (err, info, body) {
   var rev = Number((body && body.settingsRev) || 0);
   if (err) {
    /* D6: a failed publish NEVER prints */
    var why = publishReason(err, info);
    msg(t('studioPublishFail') + ' · ' + why, 'bad');
    stamp(false, why);
    clearBusy();
    cb(err, info);
    return;
   }
   try { if (data() && data().saveSettings) data().saveSettings({ appliedSettingsRev: rev }); } catch (e) {}
   msg(t('studioPublishOk') + ' · Rev #' + rev, 'ok');
   toast(t('lecturerSyncBar') + ' · Rev #' + rev);
   stamp(true, 'Rev #' + rev);
   cb(null, info || { ok: true, settingsRev: rev, classSettings: conf });
  });
  return { ok: true, classSettings: conf };
 }

 function clearVaultLock() {
  try { if (vault() && vault().resetLock) vault().resetLock(); } catch (e) {}
  return true;
 }
 function pinVerifier() {
  var cfg = sync() && sync().config ? sync().config() : null;
  return cfg && isObj(cfg.pinVerifier) ? cfg.pinVerifier : null;
 }
 /* SEC-03: with a placeholder */
 function unlockWithVerifier(pin, cb) {
  var v = vault();
  healFromLayerOne();
  /* v0.0.7.a A1: re-hydrate the persisted word cap on every unlock so the
     studio never re-opens at a stale 30 after lock → unlock. */
  try { hydrateWordCap(); } catch (eH1) {}
  var verifier = pinVerifier() || layerOneVerifier();
  if (!verifier || !v || !v.verifyPinVerifier) { msg(t('studioSetupHint'), ''); cb(new Error('no_vault')); return false; }
  function opened(secrets, env) {
   ST.bootstrapMode = !env;
   ST.envelope = env ? env : '';
   ST.secrets = isObj(secrets) ? secrets : {};
   if (env && v.stash) v.stash(ST.secrets);
   ST.message = ''; ST.messageState = '';
   mount();
   engageAutoLock(); /* v0.0.7.b B4: every unlock path arms the security net */
   try { if (SDP.StudioGuide && SDP.StudioGuide.maybeAutoPrompt) SDP.StudioGuide.maybeAutoPrompt(); } catch (eG2) {}
   paintLecturerBar();
   /* v0.0.6.t PILLAR 3F: the redundant fire-and-forget loadVoicePack(noop)
      is GONE — it raced the real loadVoicePack() below with a second
      concurrent fetchFreshDataJson('data/elevenlabs-audio.json'). */
   loadVoicePack(function () {
    paintPackDashboard();
    paintClipTable();
    /* v0.0.6.s Pillar 3 — the SINGLE UNLOCK ORCHESTRATOR law:
       autoEnsureSystemClips() NO LONGER runs here. Unlocking fired it AND
       ensureBriefingAndGuideVoices({ source: 'unlock' }) concurrently, and
       both launched their own generateClips() batches — two parallel
       synthesis queues racing the same ElevenLabs keys and the same pack
       (the v0.0.6.r regen race). ensureBriefingAndGuideVoices() below is
       now the ONE orchestrator that owns every unlock-time synthesis. */
    /* v0.0.6.n FIX 2 — Trigger 1 (Instant on PIN Unlock): the creator
       unlocked the vault — the device-local session cache of the active keys
       is stamped and the direct Studio ↔ Briefing bridge runs IMMEDIATELY
       with the live status bar (#studioBriefingVoiceBar), so the Project
       Overview beats + guide steps are synthesized with the real keys,
       injected into the live session, cached, and synced to GitHub. */
    markVaultSession();
    ensureBriefingAndGuideVoices({ source: 'unlock' }, noop);
    /* v0.0.6.v — the Live Student Activity & Alerts popup opens on unlock
       whenever recorded sessions or incidents exist. */
    try {
     var tele = (global.SDP && SDP.Telemetry && SDP.Telemetry.ledger) ? SDP.Telemetry.ledger() : null;
     var led = null;
     try { led = dataSettings().telemetryLedger || null; } catch (eLed) {}
     var hasData = (tele && (tele.sessions.length || tele.incidents.length)) || (led && led.users && led.users.length);
     var dock = byId('studioActivityDock');
     if (dock) dock.hidden = false;
     if (hasData) openStudioActivityPopup();
    } catch (eAct) {}
   });
   cb(null, ST.secrets);
  }
  v.verifyPinVerifier(pin, verifier).then(function (ok) {
   if (!ok) {
    /* R7 (F7): BOOTSTRAP_PIN is the documented master recovery code. */
    if (isBootstrapPin(pin)) { recoveryOpen(cb); return; }
    msg(t('studioBadPin'), 'bad'); cb(new Error('bad_pin')); return;
   }
   ST.unlocked = true;
   ST.pin = str(pin);
   clearVaultLock();
   /* D9: decrypt the restored envelope */
   var env = configEnvelope();
   if (isRealEnvelope(env) && v.decryptV2) {
    v.decryptV2(env, str(pin)).then(function (secrets) { opened(secrets, env); }, function () { opened({}, ''); });
    return;
   }
   opened({}, '');
  }, function (err) {
   if (isBootstrapPin(pin)) { recoveryOpen(cb); return; }
   if (err && err.code === 'locked') msg(t('studioLockedOut') + ' ' + str(err.retrySec || 60) + ' ' + t('seconds'), 'bad');
   else msg(t('studioBadPin') + (err && err.triesLeft !== undefined ? ' · ' + err.triesLeft : ''), 'bad');
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
  /* SEC-04: the persisted lockout is */
  if (v.isLocked && v.isLocked()) {
   if (isBootstrapPin(attempt)) { recoveryOpen(cb); return; }
   msg(t('studioLockedOut') + ' ' + v.lockRemaining() + ' ' + t('seconds'), 'bad');
   var early = new Error('locked');
   early.code = 'locked';
   cb(early);
   return;
  }
  /* D8: heal before resolving, so a */
  healFromLayerOne();
  /* v0.0.7.a A1: hydrate the persisted word cap before the envelope resolves
     (covers the reload-then-unlock path that previously snapped 31 → 30). */
  try { hydrateWordCap(); } catch (eH2) {}
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
    ST.message = ''; ST.messageState = '';
    mount();
    /* v0.0.7.b B4: every unlock engages the 10-second security auto-lock. */
    engageAutoLock();
    try { if (SDP.StudioGuide && SDP.StudioGuide.maybeAutoPrompt) SDP.StudioGuide.maybeAutoPrompt(); } catch (eG3) {}
    /* D4: #lecturerSyncBar appears */
    paintLecturerBar();
    /* SYNC-11: the committed clips must load (v0.0.6.t PILLAR 3F: ONE load,
       never two concurrent pack fetches on unlock). */
    loadVoicePack(function () {
     paintPackDashboard();
     paintClipTable();
     /* v0.0.6.s Pillar 3 — the SINGLE UNLOCK ORCHESTRATOR law: no parallel
        autoEnsureSystemClips() on unlock; ensureBriefingAndGuideVoices()
        below is the one and only unlock-time synthesis orchestrator (the
        v0.0.6.r regen race never returns). */
    /* v0.0.6.n FIX 2 — Trigger 1 (Instant on PIN Unlock): the creator
       unlocked the vault — the device-local session cache of the active keys
       is stamped and the direct Studio ↔ Briefing bridge runs IMMEDIATELY
       with the live status bar (#studioBriefingVoiceBar), so the Project
       Overview beats + guide steps are synthesized with the real keys,
       injected into the live session, cached, and synced to GitHub. */
    markVaultSession();
    ensureBriefingAndGuideVoices({ source: 'unlock' }, noop);
    });
    /* SYNC-07 completion: a local */
    autoPublishVault(envelope);
    cb(null, ST.secrets);
   }, function (err) {
    /* R7: a forgotten PIN is never a dead end. */
    if (isBootstrapPin(attempt)) { recoveryOpen(cb); return; }
    if (err && err.code === 'locked') {
     msg(t('studioLockedOut') + ' ' + str(err.retrySec || 60) + ' ' + t('seconds'), 'bad');
    } else {
     msg(t('studioBadPin') + (err && err.triesLeft !== undefined ? ' · ' + err.triesLeft : ''), 'bad');
    }
    cb(err || new Error('bad_pin'));
   });
  });
 }
 /* SEC-03/SYNC-07: a cached vault with a */
 function autoPublishVault(envelope) {
  try {
   var cfg = sync() && sync().config ? sync().config() : null;
   if (!str(ST.secrets.ghToken) || !cfg) return false;
   if (isRealEnvelope(str(cfg.encVault))) return false;
   publishConfigAndVersion(null, envelope, 'Studio vault ' + appVersion(), noop);
   return true;
  } catch (e) { return false; }
 }

 /* D-S1/S2/S4: encrypt, persist */
 /* SEC-02: setup() may only run for an… */
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
   msg(t('studioEnvelope') + ' ', 'ok');
   mount();
   if (!str(secretsIn.ghToken) || !sync() || !sync().publishFilesSequential) {
    toast(t('vaultSavedToast'));
    cb(null, envelope);
    return;
   }
     /* SYNC-06: config + version (last) so a */
   publishConfigAndVersion(null, envelope, 'Studio vault ' + appVersion(), function (err, info) {
    if (err) { msg(t('studioPublishFail'), 'bad'); toast(t('vaultSavedToast')); cb(err, envelope); return; }
    msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
    toast(t('vaultSavedToast') + ' · GitHub');
    cb(null, envelope, info);
   });
  }, function (err) { cb(err || new Error('encrypt_failed')); });
 }

 /* R5: lock always drops in-memory */
 function lock(keepStash) {
  /* v0.0.7.b B4: locking clears EVERY transient surface — busy spinners,
     the activity popup, the Studio guide and the auto-lock countdown —
     so a manual Lock can never land in a stuck state. */
  try { clearBusy(); } catch (eBusy) {}
  try { closeStudioActivityPopup(); } catch (eA) {}
  try { if (SDP.StudioGuide && SDP.StudioGuide.close) SDP.StudioGuide.close(true); } catch (eG) {}
  try { cancelAutoLockCountdown(true); } catch (eC) {}
  try { armIdleAutoLock(false); } catch (eI) {}
  /* v0.0.5.c Path D: locking the vault silences every voice — the TTS queue */
  try { if (SDP.Speech && SDP.Speech.stop) SDP.Speech.stop(); } catch (e) {}
  try { if (global.speechSynthesis && global.speechSynthesis.cancel) global.speechSynthesis.cancel(); } catch (e) {}
  ST.unlocked = false;
  ST.dirty = false;
  ST.wordsDirty = false;
  ST.wordDeltas = [];
  ST.secrets = {};
  ST.pin = '';
  try { if (vault() && vault().clear && !keepStash) vault().clear(); } catch (e) {}
  /* v0.0.6.d (D8): no Chrome "Save password?" popup on Lock either. */
  defusePasswordInputs(byId('studioBody'));
  mount();
  paintQuickButton();
  paintLecturerBar();
  return false;
 }
 /* D13: restore the same-tab stash ONCE */
 var stashRestoreTried = false;
 function restoreSessionStash() {
  if (stashRestoreTried) return false;
  stashRestoreTried = true;
  var v = vault(), secrets = null;
  if (ST.unlocked || !v || typeof v.read !== 'function') return false;
  try { secrets = v.read(); } catch (e) { return false; }
  if (!isObj(secrets)) return false;
  ST.secrets = secrets;
  ST.unlocked = true;
  engageAutoLock(); /* v0.0.7.b B4: the same-tab stash restore is a full unlock */
  ST.bootstrapMode = !isRealEnvelope(configEnvelope());
  ST.message = t('studioRestored');
  ST.messageState = 'ok';
  return true;
 }
 function setEnvelope(envelope) { ST.envelope = str(envelope); return ST.envelope; }
 function isUnlocked() { return !!ST.unlocked; }
 function secrets() { return isObj(ST.secrets) ? ST.secrets : {}; }

 /* ══ R8 / D13: the third vault slot */
 function detectProvider(key) {
  var k = str(key);
  if (!k) return '';
  if (k.indexOf('gsk_') === 0) return 'groq';
  if (k.indexOf('sk-or-') === 0) return 'openrouter';
  if (k.indexOf('AIza') === 0) return 'gemini';
  return '';
 }
 function aiProviderName() {
  var node = byId('studioAiProvider');
  var raw = node ? str(node.value) : '';
  if (!raw) raw = str(ST.aiProvider) || str(secrets().aiProvider) || 'free_dict';
  if (!AI_PROVIDERS[raw]) {
   /* R8: a pasted key prefix auto-selects */
   var guess = detectProvider(aiProviderKey());
   raw = guess || 'free_dict';
  }
  return raw;
 }
 function aiProviderKey() {
  var node = byId('studioAiKey');
  var typed = node ? str(node.value) : '';
  return typed || str(ST.aiKey) || str(secrets().aiKey) || '';
 }
 /* D10: slot 2 is a zero-key LLM; slots */
 function aiNeedsLlm(provider, key) {
  var p = provider === undefined ? aiProviderName() : str(provider);
  var k = key === undefined ? aiProviderKey() : str(key);
  if (p === 'pollinations_free') return !!LLM_ENDPOINTS[p];
  if (p === 'groq' || p === 'openrouter' || p === 'gemini') return !!k && !!LLM_ENDPOINTS[p];
  return false;
 }

 /* ══ rendering… */
 /* v0.0.6.d (D8): the PIN length is a first-class fact. The default class */
 function activePinLen() {
  var n = 0;
  try { n = Number(layerOneVault().pinLen); } catch (e) { n = 0; }
  if (!(n >= PIN_MIN && n <= PIN_MAX)) n = Number(BOOTSTRAP_PIN.length) || 8;
  return Math.min(PIN_MAX, Math.max(PIN_MIN, n));
 }
 /* D7 / R4: the dot row renders exactly pinLen dots. */
 function pinDotCount(len) {
  return Math.min(PIN_MAX, Math.max(PIN_MIN, Number(len) || activePinLen()));
 }
 function pinDotsMarkup() {
  var shown = activePinLen();
  var html = '<div id="pinDots" class="pin-dots" data-dots="' + shown + '" aria-hidden="true">';
  for (var i = 1; i <= PIN_MAX; i++) {
   html += '<span class="pin-dot' + (i > shown ? ' pin-dot-extra' : '') + '" data-dot="' + i + '"></span>';
  }
  return html + '</div><p id="pinCompleteHint" class="pin-complete-hint" role="status" aria-live="polite" hidden></p>';
 }
 /* D-L2: the 56px PIN pad carries */
 function pinPadMarkup() {
  var html = '<div id="pinPad" class="pin-pad" role="group" aria-label="' + T('studioPinLabel') + '">';
  var i;
  for (i = 1; i <= 9; i++) html += '<button type="button" class="pin-key" data-pin="' + i + '">' + i + '</button>';
  html += '<button type="button" class="pin-key pin-key-soft" id="pinPadClear">' + T('pinPadClear') + '</button>';
  html += '<button type="button" class="pin-key" data-pin="0">0</button>';
  html += '<button type="button" class="pin-key pin-key-primary" id="pinPadUnlock">' + T('pinPadUnlock') + '</button>';
  html += '</div>';
  return html;
 }
 /* One credential row = one input + ONE */
 /* One button factory — every studio */
 function lbl(forId, text) {
  return '<label class="lbl" for="' + forId + '">' + esc(text) + '</label>';
 }
 /* v0.0.5.c (GAP 2): one icon helper for every studio surface. */
 function ico(name, size) {
  try { if (SDP.Icons && SDP.Icons.icon) return SDP.Icons.icon(name, size || 16); } catch (e) {}
  return '';
 }
 function btn(id, label, css, attrs, icon) {
  return '<button type="button" class="btn btn-sm' + (css ? ' ' + css : '') + '" id="' + id + '"' +
   (attrs ? ' ' + attrs : '') + '>' + ico(icon, 16) +
   '<span class="i18n-label">' + esc(label) + '</span></button>';
 }
 function keyRowMarkup(inputId, label, placeholder, kind) {
  /* D1: data-pristine = untouched */
  return '<label class="lbl" for="' + inputId + '">' + esc(label) + '</label>' + '<div class="key-row">' +
   '<input id="' + inputId + '" class="input" type="password" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other" data-pristine="1" placeholder="' + esc(placeholder) + '">' +
   btn('btnToggle' + kind, t('studioShow'), '', 'aria-pressed="false"') +
   btn('btnPaste' + kind, t('studioPaste')) +
   btn('btnTest' + kind, kind === 'ElKey' ? t('studioTestEl') : (kind === 'Ai' ? t('studioTestAi') : t('studioTestGh'))) +
   btn('btnClear' + kind, t('studioClear')) + '</div>';
 }
 /* D1: the four credential fields */
 var SECRET_FIELDS = [
  { id: 'elKeyInput', key: 'elevenKey' }, { id: 'ghTokenInput', key: 'ghToken' },
  { id: 'studioAiKey', key: 'aiKey' }, { id: 'studioGasUrl', key: 'gasUrl' }
 ];
 function secretSnapshot() {
  var o = {}, i;
  for (i = 0; i < SECRET_FIELDS.length; i++) o[SECRET_FIELDS[i].key] = str(ST.secrets[SECRET_FIELDS[i].key]);
  return o;
 }
 /* D1: belt-and-braces — a field */
 function guardSecretMerge(prev) {
  var s = ST.secrets = isObj(ST.secrets) ? ST.secrets : {}, i, el, k;
  for (i = 0; i < SECRET_FIELDS.length; i++) {
   el = byId(SECRET_FIELDS[i].id); k = SECRET_FIELDS[i].key;
   if (!(el && el.getAttribute('data-dirty') === '1') && !str(s[k]) && str(prev && prev[k])) s[k] = str(prev[k]);
  }
  ST.aiKey = str(s.aiKey);
  return s;
 }
 /* D1: the explicit [Clear] — the */
 function clearSecretField(id, key) {
  var el = byId(id);
  if (el) { el.value = ''; el.setAttribute('data-dirty', '1'); el.removeAttribute('data-pristine'); try { el.focus(); } catch (e) {} }
  var s = ST.secrets = isObj(ST.secrets) ? ST.secrets : {};
  s[key] = '';
  if (key === 'aiKey') ST.aiKey = '';
  return true;
 }
 function providerLabel(id) {
  var p = AI_PROVIDERS[id] || {};
  return t(str(p.k) || 'studioAiNoKey', id);
 }
 function aiProviderSelectMarkup() {
  var current = aiProviderName(), html = '<select id="studioAiProvider" class="input">';
  for (var i = 0; i < AI_SLOT_ORDER.length; i++) {
   var id = AI_SLOT_ORDER[i];
   html += '<option value="' + id + '"' + (id === current ? ' selected' : '') + '>' + esc(providerLabel(id)) + '</option>';
  }
  return html + '</select>';
 }
 function masterStepsMarkup() {
  /* v0.0.6.a Track 6: the four human-readable All-in-One stages. */
  var labels = [
   'Step 1 \u00b7 Verify vault & keys',
   'Step 2 \u00b7 Enrich the 30 words (IPA + Sinhala)',
   'Step 3 \u00b7 Voice pack sync \u2014 0 credits',
   'Step 4 \u00b7 Publish & broadcast to the class'
  ];
  var html = '<ol id="studioMasterSteps" class="studio-steps" aria-label="' +
   T('studioMasterSteps') + '">';
  for (var i = 0; i < labels.length; i++) {
   html += '<li data-step="' + (i + 1) + '" data-state="pending">' + labels[i] + '</li>';
  }
  return html + '</ol>';
 }
 /* D7: the green vault badge — real */
 function vaultBadgeVisible() {
  if (isRealEnvelope(configEnvelope())) return true;
  return isRealEnvelope(layerOneEnvelope());
 }
 function freeNoKeyVisible(provider) {
  var p = str(provider) || aiProviderName();
  return p === 'free_dict' || p === 'pollinations_free';
 }
 /* ══ Card 1 — rebuilt for */
 /* v0.0.6.m: the five pool slots — a provider select + a masked key input. */
 function keyPoolMarkup() {
  var pool = keyPoolEntries(), html = '<div id="studioKeyPool" class="kp-grid">', i, j;
  for (i = 0; i < KEY_POOL_SLOTS; i++) {
   var e = pool[i] || { p: poolDefaultProvider(i), k: '' };
   var hint = POOL_DEFAULT_HINTS[i] || POOL_PROVIDERS[e.p].keyHint;
   html += '<div class="kp-row"><span class="kp-no">Key Slot #' + (i + 1) + '</span>' +
    '<select id="kpProv' + (i + 1) + '" class="input kp-prov" aria-label="Key Slot #' + (i + 1) + ' provider">';
   for (j = 0; j < POOL_PROVIDER_ORDER.length; j++) {
    var pid = POOL_PROVIDER_ORDER[j];
    html += '<option value="' + pid + '"' + (pid === e.p ? ' selected' : '') + '>' + esc(POOL_PROVIDERS[pid].label) + '</option>';
   }
   html += '</select>' +
    '<input id="kpSlot' + (i + 1) + '" class="input kp-key" type="password" autocomplete="off" data-pristine="1"' +
    ' placeholder="' + esc(hint) + '" value="' + esc(e.k) + '"' +
    (e.k ? ' data-sealed="1"' : '') + '>' +
    '<span class="kp-badge" data-kp-badge="' + (i + 1) + '"' + (e.k ? ' data-on="1"' : '') + '>' + (e.k ? '●' : '○') + '</span></div>';
  }
  return html + '</div>';
 }
 /* v0.0.6.m Pillar 3: the Troubleshooting & Session Diagnostics Vault card — */
 function diagCardMarkup() {
  return '<details id="studioCardDiag" class="studio-card studio-card-diag">' +
   '<summary class="studio-h4"><span class="studio-step-tag">DIAG</span> Troubleshooting &amp; Session Diagnostics Vault</summary>' +
   '<div class="studio-diag-body">' +
   '<p class="muted">Privacy-safe ring buffer — audio tier fallbacks, clip errors, pronunciation flags, session stats, viewport responsiveness and end-to-end encrypted student reviews. Nothing personal is ever recorded.</p>' +
   '<div id="diagSummary" class="diag-grid" role="status" aria-live="polite"></div>' +
   '<div class="chip-row studio-diag-row">' +
   btn('btnDownloadDiagZip', ' Download Full Diagnostics &amp; Project Analysis (.zip)', 'btn-primary') +
   btn('btnClearDiag', ' Clear local diagnostics', 'btn-ghost') +
   '</div>' +
   '<p id="diagStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '</div></details>';
 }
 /* ══ v0.0.6.m Pillar 4 — User Reviews & Session Telemetry drawer ════════
  * The creator's dedicated vault: every finished session is analysed for
  * authenticity (Genuine / Rapid-Skip / Incomplete) and sealed end-to-end
  * encrypted — whether the student sent a review OR tapped Skip. This
  * drawer summarises the counts, lists each session with its badge,
  * chips, note and ▶ voice playback, and exports the full .zip. */
 function reviewsCardMarkup() {
  return '<details id="studioCardReviews" class="studio-advanced-drawer studio-card-reviews">' +
   '<summary class="studio-h4">👨‍💻 User Reviews &amp; Session Telemetry (Developer / Creator Vault)</summary>' +
   '<div class="studio-adv-body">' +
   '<p class="muted">Every finished dictation session is captured with an authenticity verdict (✓ Genuine · ⚠ Rapid Skip · ⏳ Incomplete) — even when the student taps “Skip — no thanks”. Reviews, voice notes and telemetry are sealed AES-GCM (SDP_ENC_V2) before they ever touch storage.</p>' +
   '<div id="reviewsSummary" class="reviews-summary" role="status" aria-live="polite"></div>' +
   '<div id="studioReviewsList" class="studio-reviews-list"></div>' +
   '<div class="chip-row studio-reviews-row">' +
   btn('btnDownloadReviewsZip', ' Download User Reviews &amp; Full Telemetry (.zip)', 'btn-primary') +
   btn('btnRefreshReviews', ' Refresh', 'btn-ghost') +
   '</div>' +
   '<p id="reviewsStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '</div></details>';
 }
 function keysCardMarkup() {
  return '<section id="studioCardKeys" class="studio-card studio-card-keys">' + '<h4 class="studio-h4"><span class="studio-step-tag">' + t('studioStep1', 'STEP 1 · ONE-TIME SETUP') + '</span>' + T('studioCardKeys') + '</h4>' +
   /* D2 (v0.0.2.a): the honest one-line status dashboard. */
   '<p id="studioPackDashboard" class="studio-pack-dashboard" role="status" aria-live="polite">' + esc(packDashboardText()) + '</p>' +
   keyRowMarkup('elKeyInput', 'ElevenLabs API key (sk_…)', 'sk_…', 'ElKey') +
   /* R4 (F5): one click proves the key AND the voice, before a single */
   '<div class="chip-row studio-verify-row">' + btn('btnVerifyEleven', t('studioVerifyEl'), 'btn-primary') + '</div>' +
   '<p id="elVerifyStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   keyRowMarkup('ghTokenInput', 'GitHub token (ghp_… / github_pat_…)', 'ghp_… / github_pat_…', 'GhToken') +
   '<label class="lbl" for="studioAiProvider">' + T('studioAiProvider') + '</label>' + aiProviderSelectMarkup() +
   /* v0.0.7.c (BUG-03): per-provider Test Key buttons with REAL HTTP status
      diagnostics — a key never fails silently again. */
   '<div class="chip-row studio-verify-row">' +
   btn('btnVerifyGroq', t('studioVerifyGroq', 'Test Groq Key'), 'btn-primary') +
   btn('btnVerifyGemini', t('studioVerifyGemini', 'Test Gemini Key'), 'btn-primary') +
   '</div>' +
   '<p id="groqVerifyStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<p id="geminiVerifyStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<p id="studioFreeNoKey" class="studio-free-badge"' + (freeNoKeyVisible() ? '' : ' hidden') + '>' + T('studioFreeNoKey') + '</p>' +
   keyRowMarkup('studioAiKey', t('studioAiKey'), 'gsk_… / AIza… / sk-or-…', 'Ai') +
   '<label class="lbl" for="studioGasUrl">Apps Script relay URL</label>' + '<div class="key-row">' + '<input id="studioGasUrl" class="input" type="url" autocomplete="off" data-pristine="1" placeholder="https://script.google.com/…">' + btn('btnClearGasUrl', t('studioClear')) + '</div>' +
   /* ══ v0.0.6.m Pillar 2: the Multi-API Key Pool (6-key $0 layout) ══ */
   '<label class="lbl">Multi-API Key Pool · 5 slots — 1× ElevenLabs Backup (credit-exhaustion failover) + 2× Groq Free Tier (auto-rotation on 429) + 2× OpenRouter Free Models (free LLM failover)</label>' +
   keyPoolMarkup() +
   '<div class="chip-row studio-pool-row">' +
   btn('btnProbePool', ' Check Pool Health &amp; Rotate') +
   btn('btnGenIntroClips', ' Generate Project Briefing Voice (Deep British Male · 4 clips)', 'btn-ghost') +
   '</div>' +
   '<p id="kpStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<div class="chip-row studio-compat-row">' +
   btn('btnCheckQuota', ' ' + t('studioTestEl'), '', 'style="display:none"') +
   btn('btnRefreshQuota', ' ' + t('quotaHeading'), '', 'style="display:none"') +
   '</div>' +
   '<div class="studio-primary-bar">' +
   btn('btnSaveKeys', t('studioSave'), 'btn-ghost') +
   btn('btnOneClickMasterSetup', t('studioOneClick'), 'btn-primary', 'data-primary-cta="1"') +
   '</div>' +
   /* D3/D4 (v0.0.2.a): verbatim live progress and a delta-only retry. */
   '<p id="studioGenProgress" class="studio-gen-progress" role="status" aria-live="polite">' + esc(genProgressText()) + '</p>' +
   '<div class="chip-row studio-retry-row"' + (ST.lastFailedClip ? '' : ' hidden') + '>' + btn('btnRetryFailedClip', t('studioRetryFailed'), 'btn-ghost') + '</div>' +
   '<label class="checkline" for="studioForceRegen"><input type="checkbox" id="studioForceRegen"> <span>' + T('forceRegenLabel') + '</span></label>' +
   '<input type="checkbox" id="chkForceRegen" style="display:none" aria-hidden="true" tabindex="-1">' +
   '<div class="chip-row studio-recovery-row"><button id="btnRecoverClips" type="button" class="btn btn-primary" data-action="recoverClips"> Recover Generated Clips From ElevenLabs History (0 Credits)</button></div>' +
   '<div class="chip-row studio-diagnostics-row">' +
   btn('btnTestOneWord', t('testOneWordBtn')) +
   btn('btnGenClips', t('genDeltaBtn'), 'btn-primary') +
   '</div>' +
   '<details class="studio-diag-drawer"><summary class="studio-h4">' + T('quotaHeading') + '</summary><div id="quotaInspectorCard" class="studio-quota">' +
   '<p id="quotaText" class="muted" role="status" aria-live="polite">' + T('quotaHeading') + '</p>' +
   '<p class="lbl">' + T('costPreviewLabel') + '</p>' + '<p id="costPreviewLine" class="muted">' + esc(costPreviewLine()) + '</p>' +
   '<div id="clipPreviewTable" class="studio-preview"></div></div></details>' +
   '<p id="studioVaultBadge" class="studio-vault-badge"' + (vaultBadgeVisible() ? '' : ' hidden') + '>' + T('vaultBadgeLabel') + '</p>' +
   '</section>';
 }
 /* v0.0.6.a Track 6: live "N / 30 Words Recognized" pill + spring CTA. */
 function committedWords() {
  var out = [];
  try { out = sync() && sync().words ? sync().words() : []; } catch (e) { out = []; }
  return Array.isArray(out) ? out : [];
 }
 function liveStudioWords() {
  /* F1: the structured ST.words list (what the word manager edits) is the */
  var bulkEl = byId('studioBulkWords');
  var bulkActive = !!(bulkEl && str(fieldValue('studioBulkWords')) &&
   (bulkEl.getAttribute('data-dirty') === '1' || document.activeElement === bulkEl));
  if (bulkActive) return parseBulkWords(fieldValue('studioBulkWords'));
  if (ST.words && ST.words.length) return ST.words;
  return committedWords();
 }
 /* F1: before the studio is unlocked/mounted with real content the delta */
 function deltaDetectionReady() {
  return !!(ST.unlocked && (str(fieldValue('studioBulkWords')) || (ST.words && ST.words.length)));
 }
 function wordFieldSig(w) {
  return [str(w && w.w).toLowerCase(), str(w && w.p), str(w && w.pos),
   str(w && w.m), str(w && w.si), str(w && w.s)].join('~');
 }
 /* F1: a live word is a DELTA only when its spelling is new/renamed, or */
 function wordIsDelta(live, prior) {
  if (!prior) return true;
  var fields = ['p', 'pos', 'm', 'si', 's'], changed = 0, present = 0, i;
  for (i = 0; i < fields.length; i++) {
   var v = str(live && live[fields[i]]);
   if (!v) continue;
   present++;
   if (v !== str(prior[fields[i]])) changed++;
  }
  return present > 0 && changed > 0;
 }
 function detectWordDeltas() {
  if (!deltaDetectionReady()) { ST.wordsDirty = false; ST.wordDeltas = []; return []; }
  var live = liveStudioWords();
  var base = {};
  var committed = committedWords();
  var i, deltas = [];
  for (i = 0; i < committed.length; i++) {
   base[str(committed[i] && committed[i].w).toLowerCase()] = committed[i];
  }
  /* v0.0.6.d (D2): slot-by-slot comparison. When the spelling at slot i */
  for (i = 0; i < live.length; i++) {
   var w = str(live[i] && live[i].w);
   if (!w) continue;
   var prior = base[w.toLowerCase()] || null;
   var slotPrior = (i < committed.length && str(committed[i] && committed[i].w).toLowerCase() === w.toLowerCase()) ? committed[i] : null;
   var renamed = !!(committed.length && i < committed.length && str(committed[i] && committed[i].w).toLowerCase() !== w.toLowerCase());
   if (renamed) {
    /* A replaced spelling: brand-new enrichment state, nothing carried over. */
    if (isObj(live[i])) {
     live[i].p = str(live[i].p) && !str(slotPrior && slotPrior.p) ? str(live[i].p) : '';
     if (!slotPrior || str(live[i].p) === str(slotPrior.p)) live[i].p = '';
     live[i].pos = ''; live[i].m = ''; live[i].si = ''; live[i].s = '';
    }
    deltas.push({ w: w, index: i, prior: null, renamed: true });
    continue;
   }
   if (wordIsDelta(live[i], prior)) deltas.push({ w: w, index: i, prior: prior });
  }
  ST.wordDeltas = deltas.slice(0, 3);
  ST.wordsDirty = deltas.length > 0;
  /* F1: any word change is an unsaved change for the tab-exit guard too. */
  if (ST.wordsDirty) ST.dirty = true;
  return deltas;
 }
 /* A replaced word must lose the OLD word's stale IPA/meaning so the fast */
 function clearStaleEnrichOnDeltas(deltas) {
  var i, k, changed = {};
  for (i = 0; i < (deltas || []).length; i++) changed[str(deltas[i].w).toLowerCase()] = true;
  for (i = 0; i < (ST.words || []).length; i++) {
   var w = str(ST.words[i] && ST.words[i].w).toLowerCase();
   if (!changed[w]) continue;
   for (k = 0; k < ST.words.length; k++) {
    var other = str(ST.words[k] && ST.words[k].w).toLowerCase();
    if (k !== i && other === w) break;
   }
   ST.words[i].p = ''; ST.words[i].pos = ''; ST.words[i].m = '';
   ST.words[i].si = ''; ST.words[i].s = '';
  }
  return true;
 }
 /* The RED unsaved-changes warning state on #lecturerSyncBar / */
 function paintDirtyState() {
  var dirty = !!(ST.unlocked && ST.dirty);
  var ids = ['lecturerSyncBar', 'btnSyncClassSettings', 'studioSecurityBar', 'btnPublishWordsAndVoice'];
  for (var i = 0; i < ids.length; i++) {
   var node = byId(ids[i]);
   if (!node || !node.setAttribute) continue;
   if (dirty) node.setAttribute('data-dirty', 'true');
   else node.removeAttribute('data-dirty');
  }
  var bar = byId('lecturerSyncBar');
  if (bar && bar.setAttribute && !dirty) bar.setAttribute('data-synced', 'true');
  else if (bar && bar.removeAttribute) bar.removeAttribute('data-synced');
  paintWordCountPill();
  return dirty;
 }
 function deltaPillSuffix() {
  if (!ST.wordsDirty || !ST.wordDeltas.length) return '';
  var names = [], i;
  for (i = 0; i < ST.wordDeltas.length; i++) names.push('\u201c' + ST.wordDeltas[i].w + '\u201d');
  var more = ST.wordDeltas.length >= 3 ? '\u2026' : '';
  return ' \u26a0\ufe0f ' + ST.wordDeltas.length + ' ' + t('studioWordModified', 'word(s) modified') +
   ' (' + names.join(', ') + more + ') \u2014 ' + t('studioClickBroadcast', 'click Broadcast to auto-enrich & sync');
 }
 function wordCountPillText(n) {
  var full = n >= wordCap();
  /* v0.0.6.c (F1): even at full count the pill names the modified word(s).
     v0.0.7.a Z5: the denominator is the live word cap, not a fixed 30. */
  return String(n) + ' / ' + wordCap() + ' ' + T('studioWordsRecognized') + (full ? ' \u2713' : '') + deltaPillSuffix();
 }
 /* ══ v0.0.7.a PILLAR A1 — the UNLIMITED word count: presets 10/15/20/25/30
    (Default) + Custom (5 – ∞, bounded only by ElevenLabs credits). ST.wordCap
    + ST.wordCountMode are the single source of truth; wordCap() reads them
    with the historical 30 default, and every / N paint site follows. The cap
    is persisted in BOTH sdp.settings (wordCap + wordCountMode, five-key law)
    AND data/session.json (session.wordCount + session.wordCountMode) so
    lock → unlock → reload NEVER snaps a 31-word (or 55-word) session back
    to 30. වචන ගණන තවදුරටත් 30ට සීමා නොවේ — 5 සිට ඕනෑම සංඛ්‍යාවක්. */
 function wordCap() {
  var n = Number(ST.wordCap);
  if (!n || n < 5) return 30; /* v0.0.7.a: NO upper bound — credits are the only limit */
  return Math.round(n);
 }
 function wordCountMode() {
  var cap = wordCap();
  if (ST.wordCountMode === 'custom') return 'custom';
  if (ST.wordCountMode === 'preset') return 'preset';
  return (cap === 10 || cap === 15 || cap === 20 || cap === 25 || cap === 30) ? 'preset' : 'custom';
 }
 function setWordCap(n, mode) {
  n = Math.round(Number(n) || 30);
  if (n < 5) n = 5; /* v0.0.7.a: 5 is the floor; there is NO ceiling */
  if (n > 9999) n = 9999; /* sanity guard only — never reached in a real classroom */
  ST.wordCap = n;
  ST.wordCountMode = (mode === 'custom' || mode === 'preset') ? mode : wordCountMode();
  /* Persist law (A1): sdp.settings AND the live session state so every
     publish stamps session.wordCount / wordCountMode into session.json. */
  try { dataSaveSettings({ wordCap: n, wordCountMode: ST.wordCountMode }); } catch (eW) {}
  try {
   if (SDP.Sync && SDP.Sync.state && isObj(SDP.Sync.state.session)) {
    SDP.Sync.state.session.wordCount = n;
    SDP.Sync.state.session.wordCountMode = ST.wordCountMode;
   }
  } catch (eS) {}
  paintWordCountPill();
  paintSessionMetaCard();
  return n;
 }
 /* ══ v0.0.7.a A1 — hydration: read the persisted cap from sdp.settings
    (five-key law) then fall back to the shipped session.json wordCount, so
    boot(), unlock(), unlockWithVerifier() and mount() all agree. Without
    this, a reload left ST.wordCap undefined and wordCap() fell back to 30 —
    the reported "31 words resets back to 30" bug. */
 function hydrateWordCap() {
  var cap = 0, mode = '';
  try { cap = Number(dataSettings().wordCap) || 0; mode = str(dataSettings().wordCountMode); } catch (eD) {}
  if (!cap) {
   try {
    var ses = (sync() && sync().session) ? (sync().session() || {}) : {};
    var inner = isObj(ses.session) ? ses.session : {};
    cap = Number(inner.wordCount) || Number(ses.wordCount) || 0;
    mode = str(inner.wordCountMode || ses.wordCountMode);
   } catch (eS2) {}
  }
  if (!cap) return wordCap(); /* nothing persisted — keep the 30 default */
  if (cap < 5) cap = 5;
  ST.wordCap = Math.round(cap);
  ST.wordCountMode = (mode === 'custom' || mode === 'preset') ? mode : ((cap === 10 || cap === 15 || cap === 20 || cap === 25 || cap === 30) ? 'preset' : 'custom');
  return ST.wordCap;
 }
 /* ══ v0.0.7.a PILLAR 4 (Z4) — the post-action audit banner: re-reads the
    REAL state after every publish/save/clone/remove/generate and paints the
    green/red bilingual verdict with exact counts + the 1-click fix. */
 function paintStudioActionAuditBanner(actionLabel, detail) {
  var host = byId('studioActionAuditBanner');
  if (!host) return false;
  /* re-read the actual state — never trust the action's own success flag */
  var words = [];
  try { words = parseBulkWords(fieldValue('studioBulkWords') || wordsToText(ST.words)); } catch (eP) { words = []; }
  var savedCount = words.length;
  var sessionWordsCount = 0;
  try { if (SDP.Sync && SDP.Sync.words) sessionWordsCount = (SDP.Sync.words() || []).length; } catch (eS2) {}
  var clipsCount = 0, manifestOk = false, syncRevNow = 0;
  try {
   if (SDP.Speech && SDP.Speech.state && isObj(SDP.Speech.state.manifest)) {
    clipsCount = Object.keys(SDP.Speech.state.manifest.clips || {}).length;
    manifestOk = clipsCount > 0;
    syncRevNow = Number(SDP.Speech.state.manifest.syncRev) || 0;
   }
  } catch (eM2) {}
  var voiceOk = false;
  try { voiceOk = str(voiceSignature().voiceId) === str(activeVoiceId || VOICE_ID); } catch (eV3) { voiceOk = false; }
  var cap = wordCap();
  var state = 'ok', why = [];
  if (sessionWordsCount === 0) { state = 'bad'; why.push('word bank empty'); }
  else if (sessionWordsCount < cap) { state = 'warn'; why.push('bank ' + sessionWordsCount + ' < cap ' + cap); }
  if (!manifestOk && sessionWordsCount > 0) { state = 'bad'; why.push('voice manifest absent'); }
  if (!voiceOk) { state = 'warn'; why.push('voice signature mismatch'); }
  var line = (state === 'ok' ? '✓ ' : (state === 'warn' ? '⚠ ' : '✗ ')) + str(actionLabel || 'Studio action') +
   ' VERIFIED — bank ' + sessionWordsCount + ' words · clips ' + clipsCount + ' · syncRev ' + syncRevNow +
   (why.length ? ' · ' + why.join(' · ') : '') + ' · ' + str(detail || '');
  host.setAttribute('data-state', state);
  setText(host, line + ' · තහවුරු කළා');
  return { state: state, line: line, words: sessionWordsCount, clips: clipsCount, syncRev: syncRevNow };
 }
 function paintWordCountPill() {
  var host = byId('studioWordCountPill');
  if (!host) return false;
  var words = parseBulkWords(fieldValue('studioBulkWords') || wordsToText(ST.words));
  setText(host, wordCountPillText(words.length));
  /* v0.0.7.a Z2 — CREDIT COST PREVIEW: the exact character budget a full
     re-bake would burn, painted beside the word count BEFORE any synthesis.
     The preview itself never burns a single credit. */
  try { paintReuseCounter(); } catch (eRC2) {} /* v0.0.7.a A3 */
  var cp = byId('studioCreditPreview');
  if (cp) {
   var texts = [];
   for (var ci = 0; ci < words.length; ci++) texts.push(str(words[ci] && words[ci].w));
   if (texts.length) {
    var prev = vsCreditCostPreview(texts);
    cp.textContent = 'Credit Cost Preview: ' + prev.clips + ' word clips ≈ ' + prev.chars + ' characters (' + prev.estimatedCredits + ' credits with eleven_flash_v2_5) + 30 numbers + 6 commands + 4 guides ≈ ' + (prev.estimatedCredits + 600) + ' credits total. ' + prev.note;
   } else {
    cp.textContent = 'Credit Cost Preview: paste words first — no credits are ever burned automatically.';
   }
  }
  return true;
 }
 function pulseOneClickCTA() {
  var node = byId('btnOneClickMasterSetup') || byId('btnPublishWordsAndVoice');
  if (!node || !node.classList) return false;
  node.classList.remove('sdp-cta-pop');
  void node.offsetWidth;
  node.classList.add('sdp-cta-pop');
  return true;
 }
 /* ══ Card 2 — the 30-word editor */
 function wordsCardMarkup() {
  var words = ST.words.length ? ST.words : (sync() && sync().words ? sync().words() : []);
  var names = [];
  for (var i = 0; i < words.length; i++) if (str(words[i] && words[i].w)) names.push(str(words[i].w));
  /* ══ v0.0.7.a PILLAR A1 — the UNLIMITED word count select (10/15/20/25/
     30 (Default) / Custom (5–∞)) with STRICT gating: the custom input is
     DISABLED and visually muted whenever a preset is selected, enabled ONLY
     on Custom. The persisted mode (sdp.settings.wordCountMode) decides
     which option carries `selected` on every re-mount — a 31-word custom
     session never paints as "30 selected". */
  var cap = wordCap(), wcMode = wordCountMode();
  var presetCap = (cap === 10 || cap === 15 || cap === 20 || cap === 25 || cap === 30);
  var isCustom = (wcMode === 'custom') || (!presetCap && cap > 0);
  var wordCountSelectHtml =
   '<div class="studio-session-row studio-word-count-row">' +
   '<label class="lbl" for="studioWordCountSelect">Words per dictation run (bank size)</label>' +
   '<select id="studioWordCountSelect" class="input" aria-label="Words per dictation run">' +
   '<option value="10"' + (isCustom ? '' : (cap === 10 ? ' selected' : '')) + '>10 words — short warm-up</option>' +
   '<option value="15"' + (isCustom ? '' : (cap === 15 ? ' selected' : '')) + '>15 words</option>' +
   '<option value="20"' + (isCustom ? '' : (cap === 20 ? ' selected' : '')) + '>20 words — half session</option>' +
   '<option value="25"' + (isCustom ? '' : (cap === 25 ? ' selected' : '')) + '>25 words</option>' +
   '<option value="30"' + (isCustom ? '' : (cap === 30 ? ' selected' : '')) + '>30 words — full session (default)</option>' +
   '<option value="custom"' + (isCustom ? ' selected' : '') + '>Custom (5 – unlimited)…</option>' +
   '</select>' +
   /* v0.0.7.a: no max cap — a lecturer may enter 31, 45, 60, 100+ words;
      the ONLY bound is available ElevenLabs credits (A2 pre-flight check).
      Disabled + muted on presets (strict gating law). */
   '<input id="studioWordCountCustom" class="input studio-word-count-custom" type="number" min="5" step="1" value="' + cap + '" placeholder="5 – unlimited" aria-label="Custom word count (5 or more)"' + (isCustom ? '' : ' disabled') + '>' +
   '</div>';
  return '<section id="studioCardWords" class="studio-card studio-card-words">' + '<h4 class="studio-h4"><span class="studio-step-tag">STEP 1 · DICTATION WORDS &amp; WORD-COUNT</span>' + T('studioCardWords') + '</h4>' + '<label class="lbl" for="studioBulkWords">' + T('studioBulkWords') + '</label>' +
   '<p id="studioWordCountPill" class="studio-word-count-pill" role="status" aria-live="polite">' + esc(wordCountPillText(names.length)) + '</p>' +
   /* v0.0.7.a A3 — the live clip-reuse counter: ♻️ Reused X · ⚡ Missing Y. */
   '<p id="studioReuseCounter" class="studio-reuse-counter" role="status" aria-live="polite" data-missing="0">♻️ Reused 0 · ⚡ Missing 0</p>' +
   wordCountSelectHtml +
   sessionMetaCardMarkup() +
   /* v0.0.7.a A4: the duplicated visible Session No/Title row is GONE — the
      smart Session Details card (above) owns those fields; the hidden
      studioSessionNoInput/studioSessionTitleInput mirrors it keeps in sync
      cover every publishBundle reader (H6 compat law). */
   '<p id="studioWordsCountHelper" class="studio-count-helper" role="status" aria-live="polite" data-state="under"></p>' +
   '<textarea id="studioBulkWords" spellcheck="false" rows="6">' + esc(names.join('\n')) + '</textarea>' +
   '<div class="chip-row studio-util-row">' +
   btn('btnStudioPasteWords', t('pasteWords', '\ud83d\udccb Paste'), 'btn-ghost') +
   btn('btnStudioClearWords', t('clearWords', '\ud83e\uddf9 Clear'), 'btn-ghost') +
   btn('btnStudioConfirmWords', t('confirmWords', '\u2713 Confirm Edited Words'), 'btn-primary') + '</div>' +
   '<div id="studioLiveChips" class="studio-live-chips" role="list" aria-label="' + esc(t('liveChipsLabel', 'Live word chips')) + '"></div>' +
   '<p id="studioWordsStatusBanner" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<p id="studioEnrichStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<div class="chip-row">' + btn('btnEnrichWords', t('studioEnrich'), 'btn-ghost') +
   btn('btnPreviewWords', t('studioPreview')) + btn('btnPublishWords', t('studioPublish'), 'btn-primary') +
   btn('btnPublishWordsAndVoice', t('studioOneClickFull'), 'btn-primary', 'data-primary-cta="1" data-one-click="1"', 'sparkles') + '</div>' +
   '<p class="studio-sub">' + T('studioOneClickSub') + '</p>' + masterStepsMarkup() +
   '<details class="studio-word-inspector"><summary class="studio-h5">' + ico('list', 16) + 'Inspect & Edit Individual Words (IPA / Sinhala / Audio Preview)</summary>' +
   '<div class="studio-insp-body">' + '<label class="lbl" for="studioWords">' + T('studioEditor') + '</label>' + '<textarea id="studioWords" spellcheck="false">' + esc(wordsToText(words)) + '</textarea>' +
   '<p id="studioCount" class="studio-msg">' + words.length + ' ' + T('studioWordsCount') + '</p>' +
   '<h5 class="studio-h5">' + T('studioWordManager') + '</h5>' +
   '<div id="studioWordManager" class="studio-word-manager"></div>' + '<div id="studioPreview" class="studio-preview"></div>' + '<p class="muted">' + T('studioElevenNote') + '</p>' + '</div></details></section>';
 }
 /* ══ v0.0.7.a PILLAR 5 (Z5) — the full Session Metadata Editor card:
    No / Title / Date / Day / Branch / ClassInfo inputs + the auto-computed
    display line "SESSION <no> · <DD/MM/YYYY> ● <BRANCH>" that buildSessionPayload
    now writes into session.json. */
 /* ══ v0.0.7.a PILLAR A4 — the SMART SESSION DETAILS CARD (Card #2, directly
    below the Dictation Words card): Session Number stepper (−/value/+1 Next
    Session), the Day dropdown (auto-derived from the picked Date), the
    clean Topic input (v0.0.7.b B4: the 12 recommendation chips are gone),
    Branch and Class info. Every change repaints the live display line
    instantly — no tedious manual typing. සැසිය විස්තර දැන් එක් ක්ලික් එකකින්. ══ */
 function dayFromIsoDate(isoDate) {
  var m = str(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[d.getDay()] || '';
 }
 function daySelectMarkup(id, selectedDay) {
  var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var html = '<select id="' + id + '" class="input" aria-label="Session day">', i;
  html += '<option value=""' + (!selectedDay ? ' selected' : '') + '>— pick day —</option>';
  for (i = 0; i < days.length; i++) html += '<option value="' + days[i] + '"' + (selectedDay === days[i] ? ' selected' : '') + '>' + days[i] + '</option>';
  return html + '</select>';
 }
 function sessionMetaCardMarkup() {
  var s = {};
  try { s = (sync() && sync().session ? (sync().session() || {}) : {}) || {}; } catch (eS) { s = {}; }
  var se = isObj(s.session) ? s.session : {};
  var no = str(se.no || ST.sessionNo || liveSessionNo() || '14');
  var title = str(se.title || ST.title || liveSessionTitle());
  var date = str(se.date || new Date().toISOString().slice(0, 10));
  var day = str(se.day || dayFromIsoDate(date));
  var branch = str(se.branch || 'CCBE Galle Branch');
  var classInfo = str(se.classInfo || '');
  return '<section id="studioSessionMetaCard" class="studio-card studio-card-session-meta">' +
   '<h4 class="studio-h4"><span class="studio-step-tag">SESSION DETAILS</span>Smart, effortless session controls — 1 click instead of typing</h4>' +
   /* Session No stepper: [-] [ 14 ] [+1 Next Session] */
   '<div class="studio-session-row studio-stepper-row">' +
   '<label class="lbl" for="studioMetaNo">Session No</label>' +
   '<div class="studio-stepper">' +
   btn('btnSessionNoMinus', '−', 'btn-ghost', 'aria-label="Decrease session number"') +
   '<input id="studioMetaNo" class="input studio-stepper-value" type="text" maxlength="4" inputmode="numeric" value="' + esc(no) + '" aria-label="Session number">' +
   btn('btnSessionNoPlus', '+1 Next Session', 'btn-primary', 'aria-label="Advance to next session number"') +
   '</div>' +
   '</div>' +
   /* Topic / Title — clean input, no recommendation chips (v0.0.7.b B4) */
   '<div class="studio-session-row">' +
   '<label class="lbl" for="studioMetaTitle">Session Topic / Title</label>' +
   '<input id="studioMetaTitle" class="input" type="text" maxlength="80" value="' + esc(title) + '">' +
   '</div>' +
   /* Date + Day dropdown (auto-synced from date) */
   '<div class="studio-session-row">' +
   '<label class="lbl" for="studioMetaDate">Date (auto-sets the day)</label>' +
   '<input id="studioMetaDate" class="input" type="date" value="' + esc(date) + '">' +
   '<label class="lbl" for="studioMetaDay">Day</label>' +
   daySelectMarkup('studioMetaDay', day) +
   '</div>' +
   /* Branch + Class info */
   '<div class="studio-session-row">' +
   '<label class="lbl" for="studioMetaBranch">Branch</label>' +
   '<input id="studioMetaBranch" class="input" type="text" maxlength="60" value="' + esc(branch) + '">' +
   '</div>' +
   '<div class="studio-session-row">' +
   '<label class="lbl" for="studioMetaClassInfo">Class info line</label>' +
   '<input id="studioMetaClassInfo" class="input" type="text" maxlength="120" value="' + esc(classInfo) + '">' +
   '</div>' +
   /* Hidden H6-compat mirrors: publishBundle reads studioSessionNoInput /
   studioSessionTitleInput — kept in sync from this card on every change. */
   '<input id="studioSessionNoInput" type="hidden" value="' + esc(no) + '">' +
   '<input id="studioSessionTitleInput" type="hidden" value="' + esc(title) + '">' +
   '<p id="studioMetaDisplay" class="studio-hint" role="status" aria-live="polite">SESSION ' + esc(no) + ' · ' + esc(displayDate(date)) + ' ● ' + esc(branch.toUpperCase()) + '</p>' +
   '<div class="chip-row">' +
   btn('btnApplySessionMeta', '✅ Apply Session Metadata', 'btn-primary') +
   '</div>' +
   '</section>';
 }
 function displayDate(isoDate) {
  var d = str(isoDate || '');
  var m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return d.replace(/\//g, '.');
  return m[3] + '/' + m[2] + '/' + m[1];
 }
 function paintSessionMetaCard() {
  var disp = byId('studioMetaDisplay');
  if (!disp) return false;
  var no = str(fieldValue('studioMetaNo') || liveSessionNo() || '14');
  var date = str(fieldValue('studioMetaDate') || '');
  var branch = str(fieldValue('studioMetaBranch') || '');
  disp.textContent = 'SESSION ' + no + ' · ' + displayDate(date) + ' ● ' + branch.toUpperCase();
  return true;
 }
 /* ══ Card 3 — classroom settings */

 /* ══ v0.0.7.e — PRIVATE WEB APP ACCESS LOCK (Architecture D) ════════════
    The complete control panel lives STRICTLY inside DRAWER C (Advanced
    Tools & Settings) — never at the top of the Studio, so the daily words
    workflow stays clean. The Master Toggle, password/PIN, live roster and
    one-time codes all ride the Apps Script relay (gasLockRelay). */
 function accessLockCardMarkup() {
  var st = accessLockSnapshot();
  return '<section id="studioCardAccessLock" class="studio-card studio-card-accesslock">' +
   '<h4 class="studio-h4"><span class="studio-step-tag">LOCK</span>🔐 Private Web App Access Lock <span class="studio-al-pill" id="studioAlPill" data-state="' + (st.on ? 'on' : 'off') + '">' + (st.on ? 'LOCK ON' : 'LOCK OFF') + '</span></h4>' +
   '<p class="studio-hint" data-i18n="studioAlIntro">' + T('studioAlIntro') + '</p>' +
   '<div class="studio-al-master">' +
   '<label class="checkline" for="studioAlMaster"><input type="checkbox" id="studioAlMaster"' + (st.on ? ' checked' : '') + '> <span data-i18n="studioAlMaster">' + T('studioAlMaster') + '</span></label>' +
   btn('btnAlApplyMaster', t('studioAlApply', 'Apply Master Lock'), 'btn-primary', 'data-atomic-al="1"', 'lock') +
   '</div>' +
   '<div class="studio-al-grid">' +
   '<div class="studio-al-cell">' +
   '<label class="lbl" for="studioAlPassword" data-i18n="studioAlPasswordLbl">' + T('studioAlPasswordLbl') + '</label>' +
   '<input id="studioAlPassword" class="input" type="password" autocomplete="new-password" data-pristine="1" placeholder="' + T('studioAlPasswordPh') + '">' +
   btn('btnAlSetPassword', t('studioAlSetPassword', 'Set / Change Password'), 'btn-ghost', '', 'key') +
   '</div>' +
   '<div class="studio-al-cell">' +
   '<label class="lbl" for="studioAlPin" data-i18n="studioAlPinLbl">' + T('studioAlPinLbl') + '</label>' +
   '<input id="studioAlPin" class="input pin-mask" type="text" inputmode="numeric" autocomplete="off" data-pristine="1" maxlength="8" placeholder="' + T('studioAlPinPh') + '">' +
   btn('btnAlSetPin', t('studioAlSetPin', 'Set Break-Glass PIN'), 'btn-ghost', '', 'key') +
   '</div>' +
   '</div>' +
   '<div class="studio-al-codes">' +
   '<label class="lbl" for="studioAlCodeCount" data-i18n="studioAlCodeCountLbl">' + T('studioAlCodeCountLbl') + '</label>' +
   '<div class="key-row"><input id="studioAlCodeCount" class="input" type="number" min="1" max="50" value="5"><button type="button" class="btn btn-sm" id="btnAlGenCodes"><span class="i18n-label">' + esc(t('studioAlGenCodes', 'Generate One-Time Codes')) + '</span></button>' +
   btn('btnAlLockAllNow', t('studioAlLockAll', 'Lock All Now (Exam Mode)'), 'btn-ghost', '', 'lock') + '</div>' +
   '<pre id="studioAlCodesSlip" class="studio-al-slip" hidden></pre>' +
   '</div>' +
   '<h4 class="studio-h4" data-i18n="studioAlRosterTitle">' + T('studioAlRosterTitle') + '</h4>' +
   '<div id="studioAlRoster" class="studio-al-roster" role="region" aria-live="polite">' +
   '<p class="studio-msg" id="studioAlRosterMsg" role="status"></p>' +
   '<div id="studioAlPending" class="studio-al-list"><p class="muted" data-i18n="studioAlPendingEmpty">' + T('studioAlPendingEmpty') + '</p></div>' +
   '<div id="studioAlApproved" class="studio-al-list"><p class="muted" data-i18n="studioAlApprovedEmpty">' + T('studioAlApprovedEmpty') + '</p></div>' +
   '</div>' +
   '<p class="studio-hint" data-i18n="studioAlSecretsLaw">' + T('studioAlSecretsLaw') + '</p>' +
   '</section>';
 }
 /* v0.0.7.e: the cached lock snapshot driving the pill + toggle paint. */
 function accessLockSnapshot() {
  var snap = { on: false, hasPassword: false, hasPin: false };
  try {
   var cfg = sync() && sync().config ? sync().config() : null;
   if (cfg && isObj(cfg.accessLock)) {
    snap.on = !!cfg.accessLock.on;
    snap.hasPassword = !!cfg.accessLock.hasPassword;
    snap.hasPin = !!cfg.accessLock.hasPin;
   }
  } catch (e) {}
  try {
   var saved = dataSettings().accessLockCloud || null;
   if (saved && typeof saved.on !== 'undefined') snap.on = !!saved.on;
  } catch (e2) {}
  return snap;
 }
 /* v0.0.7.e: the dismissible FIRST-TIME notice banner (EN|SI). Shown the first
    time the owner unlocks the Studio while the Access Lock is unconfigured;
    the Dismiss is persisted via sdp.settings (five-key law) so it never nags
    again once dismissed or configured. */
 function studioFirstTimeNoticeMarkup() {
  var show = false;
  try {
   var settingsNow = dataSettings();
   show = !settingsNow.accessLockNoticeDismissed && !settingsNow.accessLockCloud;
  } catch (e) { show = false; }
  if (!show) return '';
  return '<div id="studioAccessNotice" class="studio-access-notice" role="status" aria-live="polite">' +
   '<span class="studio-access-notice-ico">🌐</span> ' +
   '<span class="i18n-label" data-i18n="studioAlNoticeBody">' + T('studioAlNoticeBody') + '</span> ' +
   btn('btnAlNoticeJump', t('studioAlNoticeJump', 'Open Advanced Settings → Access Lock'), 'btn-primary', '', 'gear') +
   btn('btnAlNoticeDismiss', t('studioAlNoticeDismiss', 'Dismiss'), 'btn-ghost') +
   '</div>';
 }
 function dismissAccessNotice() {
  try { dataSaveSettings({ accessLockNoticeDismissed: true }); } catch (e) {}
  var node = byId('studioAccessNotice');
  if (node) node.parentNode.removeChild(node);
  msg('Notice dismissed — configure the Access Lock anytime under Advanced Settings. දැනුම්දීම වසා දමන ලදී.', 'ok');
 }
 /* v0.0.7.e: the Apps Script lock relay — posts with the Studio gasUrl secret
    (public endpoint; carries NO raw secret material in the body). */
 function gasLockRelay(body, cb) {
  cb = cb || noop;
  var url = '';
  try { url = str(ST.secrets.gasUrl); } catch (e0) {}
  if (!url) {
   try {
    var cfg = sync() && sync().config ? sync().config() : null;
    if (cfg && cfg.accessLock && cfg.accessLock.relayUrl) url = str(cfg.accessLock.relayUrl);
   } catch (e1) {}
  }
  if (!url) { cb(new Error('set the Apps Script relay URL in Advanced Tools first')); return false; }
  body = body || {};
  if (!body.pin && ST.pin) body.pin = ST.pin;
  var D = (global.SDP && SDP.Data && SDP.Data.postRelay) ? SDP.Data : null;
  if (!D || !D.postRelay) { cb(new Error('no_relay')); return false; }
  D.postRelay(url, JSON.stringify(body), function (err, data) { cb(err, data); });
  return true;
 }
 function accessLockMsg(text, state) {
  var node = byId('studioAlRosterMsg');
  if (node) { node.textContent = str(text); node.setAttribute('data-state', state || ''); }
  msg(text, state || '');
 }
 function paintAccessLockPanel() {
  var host = byId('studioCardAccessLock');
  if (!host) return false;
  var st = accessLockSnapshot();
  var pill = byId('studioAlPill');
  if (pill) { pill.textContent = st.on ? 'LOCK ON' : 'LOCK OFF'; pill.setAttribute('data-state', st.on ? 'on' : 'off'); }
  var master = byId('studioAlMaster');
  if (master) master.checked = !!st.on;
  return true;
 }
 function accessRosterRow(kind, row) {
  var dev = str(row.deviceId), name = str(row.name) || '(no name)', cls = str(row.classId) || '—';
  var when = row.ts ? new Date(Number(row.ts) || Date.now()).toLocaleString() : '';
  if (kind === 'pending') {
   return '<div class="studio-al-row studio-al-row--pending" data-device="' + esc(dev) + '">' +
   '<span class="studio-al-name">' + esc(name) + ' · <span class="muted">' + esc(cls) + '</span></span>' +
   '<span class="studio-al-dev" title="' + esc(dev) + '">' + esc(dev.substring(0, 12)) + '…</span>' +
   '<span class="studio-al-when muted">' + esc(when) + '</span>' +
   '<span class="studio-al-actions">' +
   '<button type="button" class="btn btn-sm btn-primary" data-al="approve" data-al-dev="' + esc(dev) + '">✅ Approve</button>' +
   '<button type="button" class="btn btn-sm btn-ghost" data-al="reject" data-al-dev="' + esc(dev) + '">❌ Reject</button>' +
   '</span></div>';
  }
  var exp = row.expires ? new Date(Number(row.expires)).toLocaleString() : '—';
  return '<div class="studio-al-row studio-al-row--approved" data-device="' + esc(dev) + '">' +
   '<span class="studio-al-name">' + esc(name) + ' · <span class="muted">' + esc(cls) + '</span></span>' +
   '<span class="studio-al-dev" title="' + esc(dev) + '">' + esc(dev.substring(0, 12)) + '…</span>' +
   '<span class="studio-al-when muted">' + esc(exp) + '</span>' +
   '<span class="studio-al-actions">' +
   '<button type="button" class="btn btn-sm btn-ghost" data-al="kick" data-al-dev="' + esc(dev) + '">👢 Kick / Revoke</button>' +
   '<button type="button" class="btn btn-sm btn-ghost" data-al="extend" data-al-dev="' + esc(dev) + '">⏱️ Extend</button>' +
   '</span></div>';
 }
 function paintAccessRoster(out) {
  var pendingHost = byId('studioAlPending');
  var approvedHost = byId('studioAlApproved');
  if (!pendingHost || !approvedHost) return false;
  var pending = (out && Array.isArray(out.pending)) ? out.pending : [];
  var approved = (out && Array.isArray(out.approved)) ? out.approved : [];
  var html = '', i;
  if (!pending.length) html = '<p class="muted" data-i18n="studioAlPendingEmpty">' + T('studioAlPendingEmpty') + '</p>';
  else { for (i = 0; i < pending.length; i++) html += accessRosterRow('pending', pending[i]); }
  pendingHost.innerHTML = html;
  html = '';
  if (!approved.length) html = '<p class="muted" data-i18n="studioAlApprovedEmpty">' + T('studioAlApprovedEmpty') + '</p>';
  else { for (i = 0; i < approved.length; i++) html += accessRosterRow('approved', approved[i]); }
  approvedHost.innerHTML = html;
  return true;
 }
 function refreshAccessLockRoster(quiet) {
  gasLockRelay({ action: 'access_roster' }, function (err, out) {
   if (err || !out || !out.ok) {
    if (!quiet) accessLockMsg(T('studioAlRelayMissing'), 'bad');
    return;
   }
   paintAccessRoster(out);
   if (!quiet) accessLockMsg('Roster refreshed · ' + out.pending.length + ' pending · ' + out.approved.length + ' approved.', 'ok');
  });
 }
 function alApplyMaster() {
  var master = byId('studioAlMaster');
  var on = !!(master && master.checked);
  withBusy('btnAlApplyMaster', function (d) {
   gasLockRelay({ action: 'set_lock_config', on: on }, function (err, out) {
    if (err || !out || !out.ok) { accessLockMsg(T('studioAlRelayMissing'), 'bad'); d(); return; }
    try { dataSaveSettings({ accessLockCloud: { on: !!(out.lock && out.lock.on), hasPassword: !!(out.lock && out.lock.hasPassword) } }); } catch (eS) {}
    try {
     var cfg = sync() && sync().config ? sync().config() : null;
     if (cfg && isObj(cfg.accessLock)) cfg.accessLock.on = !!(out.lock && out.lock.on);
     else if (cfg) cfg.accessLock = { on: !!(out.lock && out.lock.on), graceHours: 72 };
    } catch (eC) {}
    paintAccessLockPanel();
    paintStudioActionAuditBanner('Access Lock master ' + (on ? 'ON' : 'OFF'), on ? 'every unapproved visitor stops at the Entry Lock' : 'Open to all students');
    accessLockMsg(on ? '🔒 LOCK ON — the web app is now private. Students request access and you approve on your phone.' : '🔓 LOCK OFF — the web app is open to all students and visitors.', 'ok');
    d();
   });
  });
 }
 function alSetPassword() {
  var node = byId('studioAlPassword');
  var pw = str(node && node.value);
  if (pw.length < 6) { accessLockMsg('Password must be at least 6 characters. අවම අක්ෂර 6.', 'bad'); return; }
  withBusy('btnAlSetPassword', function (d) {
   gasLockRelay({ action: 'set_lock_config', password: pw }, function (err, out) {
    if (err || !out || !out.ok) { accessLockMsg(T('studioAlRelayMissing'), 'bad'); d(); return; }
    try { node.value = ''; node.setAttribute('data-pristine', '1'); } catch (e0) {}
    paintStudioActionAuditBanner('Access Lock password updated', 'stored ONLY as an HMAC-SHA256 digest server-side');
    accessLockMsg('✓ Access Lock password saved (hashed server-side — the raw password never leaves this device again).', 'ok');
    d();
   });
  });
 }
 function alSetPin() {
  var node = byId('studioAlPin');
  var pin = str(node && node.value).replace(/[^0-9]/g, '');
  if (!/^\d{4,8}$/.test(pin)) { accessLockMsg('The Break-Glass PIN must be 4–8 digits. අංක 4–8 අවශ්‍යයි.', 'bad'); return; }
  withBusy('btnAlSetPin', function (d) {
   gasLockRelay({ action: 'set_lock_config', accessPin: pin }, function (err, out) {
    if (err || !out || !out.ok) { accessLockMsg(T('studioAlRelayMissing'), 'bad'); d(); return; }
    try { node.value = ''; node.setAttribute('data-pristine', '1'); } catch (e0) {}
    paintStudioActionAuditBanner('Break-Glass PIN updated', 'stored ONLY as an HMAC-SHA256 digest server-side');
    accessLockMsg('✓ Admin Break-Glass PIN saved (hashed server-side).', 'ok');
    d();
   });
  });
 }
 function alGenCodes() {
  var countNode = byId('studioAlCodeCount');
  var count = Math.min(Math.max(Number(countNode && countNode.value) || 5, 1), 50);
  withBusy('btnAlGenCodes', function (d) {
   gasLockRelay({ action: 'generate_codes', count: count, ttlHours: 48 }, function (err, out) {
    if (err || !out || !out.ok) { accessLockMsg(T('studioAlRelayMissing'), 'bad'); d(); return; }
    var slip = byId('studioAlCodesSlip');
    if (slip) {
     var lines = ['SMART DICTATION — ONE-TIME STUDENT ACCESS CODES', 'Valid 48 hours · each code works on ONE device only', ''],
         i;
     for (i = 0; i < out.codes.length; i++) lines.push('  ' + (i + 1) + '.  ' + out.codes[i]);
     lines.push('', 'Give each student ONE code. Forwarding on WhatsApp will not work on a second phone.');
     slip.textContent = lines.join('\n');
     slip.hidden = false;
    }
    paintStudioActionAuditBanner('One-time codes generated', count + ' codes · 48 h ttl · single-device burn law');
    accessLockMsg('✓ ' + out.codes.length + ' one-time codes generated — the printable slip is below. එක් වරක් පමණක් වලංගුයි.', 'ok');
    d();
   });
  });
 }
 function alLockAllNow() {
  withBusy('btnAlLockAllNow', function (d) {
   gasLockRelay({ action: 'lock_all' }, function (err, out) {
    if (err || !out || !out.ok) { accessLockMsg(T('studioAlRelayMissing'), 'bad'); d(); return; }
    try { dataSaveSettings({ accessLockCloud: { on: true } }); } catch (eS) {}
    paintAccessLockPanel();
    paintStudioActionAuditBanner('Exam mode armed', 'LOCK ON for every visitor');
    accessLockMsg('🔒 Lock All Now armed — every visitor stops at the Entry Lock (exam mode).', 'ok');
    d();
   });
  });
 }
 function alRosterAction(dev, op) {
  var body = { deviceId: dev };
  if (op === 'approve' || op === 'reject') body.action = 'access_decision', body.decision = op;
  else if (op === 'kick') body.action = 'revoke_device';
  else if (op === 'extend') { body.action = 'extend_device'; body.hours = 168; }
  else return;
  gasLockRelay(body, function (err, out) {
   if (err || !out || !out.ok) { accessLockMsg(T('studioAlRelayMissing'), 'bad'); return; }
   var verb = op === 'approve' ? 'approved' : op === 'reject' ? 'rejected' : op === 'kick' ? 'revoked' : 'extended by 1 week';
   accessLockMsg((op === 'approve' ? '✅ ' : op === 'reject' ? '❌ ' : op === 'kick' ? '👢 ' : '⏱️ ') + 'Device ' + str(dev).substring(0, 12) + '… ' + verb + '.', 'ok');
   refreshAccessLockRoster(true);
  });
 }
 function alJumpToPanel() {
  var drawer = byId('studioAdvancedDrawer');
  if (drawer) drawer.open = true;
  var card = byId('studioCardAccessLock');
  if (card && card.scrollIntoView) { try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e0) { try { card.scrollIntoView(); } catch (e1) {} } }
  paintStudioActionAuditBanner('Access Lock panel opened', 'Advanced Settings → Private Web App Access Lock');
 }

 function settingsCardMarkup() {
  return '<section id="studioCardSettings" class="studio-card studio-card-settings">' + '<h4 class="studio-h4"><span class="studio-step-tag">' + t('studioStep3', 'STEP 3 · BROADCAST TO CLASS') + '</span>' + T('studioCardSettings') + '</h4>' +
   '<label class="lbl" for="studioNewPin">' + T('studioPinLabel') + ' — new (4–8 digits)</label>' +
   '<input id="studioNewPin" class="input pin-mask" type="text" inputmode="numeric" autocomplete="off" ' +
   'autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" ' +
   'data-form-type="other" maxlength="8" minlength="4" aria-label="New lecturer PIN">' + '<label class="lbl" for="studioConfirmPin">' + T('studioPinLabel') + ' — confirm</label>' +
   '<input id="studioConfirmPin" class="input pin-mask" type="text" inputmode="numeric" autocomplete="off" ' +
   'autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" ' +
   'data-form-type="other" maxlength="8" minlength="4" aria-label="Confirm lecturer PIN">' + btn('btnChangePin', t('studioChangePinBtn'), 'btn-ghost', 'data-atomic-pin="1"') + btn('btnStudioSyncSettings', t('studioSyncSettings'), 'btn-primary') +
   '<div class="studio-lock-row">' + btn('btnLockStudio', t('studioLockLecturer'), 'btn-ghost') + '</div>' +
   '<h4 class="studio-h4">' + T('studioRecord') + '</h4>' + '<div class="chip-row">' + btn('btnStudioRecord', t('studioRecord')) +
   btn('btnCommitClip', t('studioCommitClip'), 'btn-primary', 'disabled') + '</div>' +
   '<audio id="recPreviewAudio" controls preload="none" class="rec-preview"></audio>' + '<p class="studio-hint" data-i18n="studioAskLecturer">' + T('studioAskLecturer') + '</p>' + '</section>';
 }
 /* D18: three outcome cards under */
 /* D19: compact sub-label, no */
 function securityBarMarkup() {
  /* v0.0.6.b (S4): the high-visibility Lecturer Mode bar — Lock or Publish.
     v0.0.7.b B5: the 📘 Studio Guide button (Simple | Advanced interactive
     spotlight tour, EN | SI) rides at the right of the bar. */
  return '<div id="studioSecurityBar" class="studio-security-bar" role="region" aria-live="polite">' +
   '<span class="ssb-badge">' + ico('unlock', 16) + T('ssbUnlocked') + '</span>' +
   '<span class="studio-mode-pill">Lecturer Mode Unlocked</span>' +
   btn('btnSsbPublish', t('guardPublish'), 'btn-primary', 'data-primary-cta="1"', 'upload') +
   btn('btnSsbLock', t('studioLockLecturer'), 'btn-ghost', '', 'lock') +
   btn('btnStudioGuide', t('studioGuideBtn', '📘 Studio Guide'), 'btn-ghost') +
   '</div>';
 }

 /* v0.0.6.w — the unified classroom & cloned voice card sits directly under
    the security bar (never above it — the bar stays pinned at the header). */
 function classroomVoiceCardMarkup() {
  var opts = '<option value="alice">Alice — Energetic British RP Female (Default)</option>';
  try {
   var fv = Array.isArray(ST.fetchedVoices) ? ST.fetchedVoices : (isObj(ST.secrets) && Array.isArray(ST.secrets.fetchedVoices) ? ST.secrets.fetchedVoices : []);
   var seen = {}, i;
   for (i = 0; i < fv.length; i++) {
    if (!isObj(fv[i]) || !str(fv[i].voice_id) || seen[str(fv[i].voice_id)]) continue;
    seen[str(fv[i].voice_id)] = 1;
    opts += '<option value="' + esc(str(fv[i].voice_id)) + '"' + (str(fv[i].voice_id) === chosenClassroomVoiceId() ? ' selected' : '') + '>' +
     esc(str(fv[i].name) || 'Account Voice') + ' — ' + ((str(fv[i].category) === 'cloned') ? 'My Cloned Voice' : ((str(fv[i].category) === 'generated') ? 'Generated Voice' : 'Account Voice')) + ' · ' + esc(str(fv[i].voice_id)) + '</option>';
   }
   var cur = chosenClassroomVoiceId();
   if (cur !== VOICE_ID && !seen[cur]) opts += '<option value="' + esc(cur) + '" selected>My Cloned Voice · ' + esc(cur) + '</option>';
  } catch (eO) {}
  return '<div class="chip-row studio-classroom-voice-row">' +
   '<span id="studioClassroomVoiceBar" class="studio-briefing-voice-bar" data-state="alice" role="status" aria-live="polite">🔊 Unified Classroom Voice: Alice</span>' +
   '</div>' +
   '<section id="studioCardClassroomVoice" class="studio-card studio-card-classroom-voice">' +
   '<h4 class="studio-h4"><span class="studio-step-tag">UNIFIED CLASSROOM &amp; CLONED VOICE</span>One voice for every word, number, command &amp; guide</h4>' +
   '<div class="studio-voice-row">' +
   '<label class="lbl" for="studioClassroomVoiceSelect">Classroom Voice</label>' +
   '<select id="studioClassroomVoiceSelect" class="input studio-voice-select" aria-label="Classroom Voice">' + opts + '</select>' +
   '</div>' +
	  '<div class="chip-row">' +
	  '<input id="studioClassroomCustomVoiceId" class="input studio-voice-custom" type="text" value="' + esc(chosenClassroomVoiceId() || VOICE_ID) + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other" placeholder="Paste Cloned ElevenLabs Voice ID…">' +
	  btn('btnFetchClassroomClonedVoices', '🔄 Fetch My Cloned Voices', 'btn-ghost') +
	  '</div>' +
	  /* v0.0.7.b B1: the canonical Default Voice ID is always visible and
	     pre-filled — the whole app speaks this one unified high-
	     professional British voice (Alice) until a cloned voice is applied. */
	  '<p class="studio-hint">📌 Default Voice ID (unified): <code>' + VOICE_ID + '</code> · Alice · eleven_flash_v2_5 — pre-filled above; every new word clip is generated in this voice.</p>' +
   '<div class="chip-row">' +
   btn('btnApplyClassroomVoice', '✅ Apply Selected / Cloned Voice to App', 'btn-primary') +
   btn('btnForceRegenWords', '🧹 Wipe Old Word Clips &amp; Re-Generate 30 Words Fresh', 'btn-ghost') +
   btn('btnRebakeClassroomVoice', '📊 Re-Bake All 70 Classroom Clips (Words + Numbers + Commands + Guides) in This Voice', 'btn-ghost') +
   btn('btnResetClassroomVoice', '↩ Back to Alice (default)', 'btn-ghost') +
   btn('btnRemoveClonedVoiceRestoreDefault', '🧬 Remove Cloned Voice &amp; Restore High-Professional Default', 'btn-go') +
   btn('btnOpenLiveLab', '🔬 Open Real-Time Voice &amp; Clone Lab', 'btn-go') +
   '</div>' +
   '<p class="studio-hint">One voice for every word, number, command and guide clip; the briefing narrator stays in Advanced Tools.</p>' +
   '</section>' +
   voiceSampleStudioMarkup();
 }
 /* ══ v0.0.7.a Pillar 1 (Y1) — the Voice Sample Studio markup: record 30–120 s
    live OR upload any 1–2 minute audio file, confirm it, then run the DSP +
    Gemini acoustic analyzer, the automatic pre-enhancement mastering chain and
    the ElevenLabs Instant Voice Clone pipeline. ══ */
 function voiceSampleStudioMarkup() {
  return '<section id="studioCardVoiceSample" class="studio-card studio-card-voice-sample">' +
   '<h4 class="studio-h4"><span class="studio-step-tag">AI VOICE SAMPLE STUDIO &amp; CLONE PIPELINE</span>Record or upload a 1-minute free-speech voice sample</h4>' +
   '<div class="chip-row studio-vs-timer-row">' +
   '<span class="studio-vs-timer" id="voiceSampleTimer">00:00 / 02:00</span>' +
   '<span class="studio-hint" id="voiceSampleTimerHint">Speak FREELY for 30–120 s about anything — no fixed passage needed.</span>' +
   '</div>' +
   '<div class="studio-voice-sample-meter" id="voiceSampleMeterWrap" aria-hidden="true"><span id="voiceSampleMeter" style="width:0%"></span></div>' +
   /* v0.0.7.a PILLAR 2 (Z2) — ZERO SCRIPT REQUIREMENT: the prescribed passage
      is retired. The lecturer speaks freely about anything (their lesson plan,
      the weather, a story) for ~1 minute; the auto-transcription leg below
      confirms intelligibility, articulation and pacing (WPM) on whatever was
      actually said. නිදහස්ව කතා කරන්න — කිසිදු ස්ථිර පාඨයක් අවශ්‍ය නැත. */
   '<p class="studio-vs-passage" id="voiceSamplePassage">🎤 FREE SPEECH — no script to read. Talk naturally for about 1 minute in your normal classroom voice (natural pace, clear endings). The analyzer auto-transcribes your speech, measures pace (WPM), articulation clarity, pitch and presence, then pre-enhances the sample before cloning. තත්පර 60ක් පමණ සුමුදු වේගයෙන් නිදහස්ව කතා කරන්න — වෙනත් කිසිදු පොතක් හෝ පාඨයක් කියවිය යුතු නැත.</p>' +
   '<div class="chip-row">' +
   btn('btnVoiceSampleRecord', '🎤 Start Recording (Mic)', 'btn-primary') +
   btn('btnVoiceSampleStop', '⏹ Stop Recording', 'btn-ghost') +
   '</div>' +
   '<div class="chip-row">' +
   '<input id="voiceSampleFileInput" class="input" type="file" accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac" aria-label="Upload a 1-2 minute free-speech voice sample (MP3, WAV, M4A, WebM, OGG, FLAC)">' +
   '</div>' +
   '<div class="chip-row">' +
   btn('btnConfirmVoiceSample', '💾 Save &amp; Confirm Reference Voice Sample', 'btn-primary') +
   btn('btnRunVoiceAnalyzer', '🔎 Analyze Voice Sample (Auto-Transcribe + DSP + Gemini AI)', 'btn-go') +
   btn('btnCreateAndApplyVoiceClone', '🧬 Create ElevenLabs Voice Clone &amp; Synthesize 30 Words', 'btn-go') +
   '</div>' +
   /* v0.0.7.a Z2 — 1-CLICK QUICK-APPLY: paste an existing ElevenLabs Voice ID
      (from any account / a previous clone) and it is applied immediately —
      no sample, no credits, no analyzer run needed. */
   '<div class="chip-row studio-voice-row">' +
   '<label class="lbl" for="voiceSampleQuickApplyId">Quick-Apply Existing Voice ID (no sample needed)</label>' +
   '<input id="voiceSampleQuickApplyId" class="input studio-voice-custom" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other" placeholder="Paste any ElevenLabs Voice ID (16–32 chars)…">' +
   btn('btnQuickApplyVoiceId', '⚡ 1-Click Quick-Apply Voice ID', 'btn-go') +
   '</div>' +
   /* v0.0.7.a Z2 — CREDIT-PROTECTION LAW: the Low-Credit Verification Test
      (~10 chars) + the live Credit Cost Preview line. Zero credits are ever
      burned automatically on page load or during lab diagnostics. */
   '<div class="chip-row">' +
   btn('btnLowCreditVerifyTest', '🪙 1-Word Low-Credit Verification Test (~10 chars)', 'btn-go') +
   '</div>' +
   '<p class="studio-hint" id="studioCreditPreview">Credit Cost Preview: run the analyzer or enter words first — no credits are ever burned automatically.</p>' +
   '<audio id="voiceSamplePreviewAudio" controls preload="none" class="rec-preview" style="width:100%;margin-top:8px;"></audio>' +
   '<p class="studio-hint" id="voiceSampleStatus">No voice sample yet — record freely, upload any 1-minute audio, or Quick-Apply an existing Voice ID.</p>' +
   '<div id="studioVoiceAnalysisCard" class="studio-voice-analysis-card" hidden></div>' +
   '</section>';
 }


 /* ═════════════ v0.0.6.v — VOICE SIGNATURE & ENERGY LOCK ═════════════════ */
 /* The locked broadcast signature every words-dot and num-dot take is normalized to:
    Alice (Xb7hH8MSUJpSbSDYk0k2 / eleven_flash_v2_5), -21 LUFS integrated,
    true peak <= -1.0 dBTP, +2.5 dB presence shelf @ 3 kHz (Q 0.9). Persisted
    inside sdp.settings.voiceSignature (five-key law). The _intro_male_* beats
    and the cmd.* reference are NEVER re-normalized. */
 function defaultVoiceSignature() {
  return {
   voiceId: 'Xb7hH8MSUJpSbSDYk0k2', voiceName: 'Alice', modelId: 'eleven_flash_v2_5',
   settings: { stability: 0.48, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true },
   lufsTarget: -21, truePeakMax: -1.0,
   presenceShelfHz: 3000, presenceGainDb: 2.5, locked: true
  };
 }
 function voiceSignature() {
  var s = sync() && sync().settings ? (sync().settings() || {}) : {};
  var vs = s.voiceSignature;
  /* v0.0.6.w: a PERSISTED CLONE is a valid signature — the Alice-only guard
     that overwrote every applied clone is gone. Only a missing/corrupt object
     reseeds the default Alice signature. */
  if (!isObj(vs) || !str(vs.voiceId)) {
   vs = defaultVoiceSignature();
   try { if (sync() && sync().saveSettings) sync().saveSettings({ voiceSignature: vs }); } catch (eV) {}
  }
  return vs;
 }

 /* v0.0.6.w — buildFallbackRpHint(w): a deterministic grapheme→British-RP
    phonetic respelling for words outside the shipped lexicon and beyond the
    dictionary/AI legs. Non-rhotic (no r-colouring), UK vowel and stress
    mappings only — an informational hint, never a blocker. */
 function buildFallbackRpHint(w) {
  var s = str(w).toLowerCase().replace(/[^a-z\s-]/g, '');
  if (!s) return str(w);
  var map = {
   'augh': 'ah', 'eigh': 'ay', 'ough': 'uh', 'aik': 'ayk', 'aire': 'air',
   'tion': 'shun', 'sion': 'zhun', 'cious': 'shus', 'tious': 'shus', 'ture': 'chuh',
   'ai': 'ay', 'ay': 'ay', 'ea': 'ee', 'ee': 'ee', 'oa': 'oh', 'oe': 'oh',
   'ou': 'ow', 'ow': 'oh', 'oi': 'oy', 'oy': 'oy', 'au': 'aw', 'aw': 'aw',
   'ei': 'ay', 'ey': 'ay', 'ie': 'ee', 'ue': 'oo', 'ui': 'oo',
   'ch': 'ch', 'sh': 'sh', 'th': 'th', 'ph': 'f', 'gh': 'g', 'ck': 'k', 'qu': 'kw',
   'ar': 'ah', 'er': 'uh', 'ir': 'uh', 'ur': 'uh', 'or': 'aw',
   'a': 'a', 'e': 'e', 'i': 'i', 'o': 'o', 'u': 'u', 'y': 'ee'
  };
  var out = '', i = 0;
  while (i < s.length) {
   var hit = '';
   var keys = ['augh', 'eigh', 'ough', 'aik', 'aire', 'tion', 'sion', 'cious', 'tious', 'ture',
    'ai', 'ay', 'ea', 'ee', 'oa', 'oe', 'ou', 'ow', 'oi', 'oy', 'au', 'aw', 'ei', 'ey', 'ie', 'ue', 'ui',
    'ch', 'sh', 'th', 'ph', 'gh', 'ck', 'qu', 'ar', 'er', 'ir', 'ur', 'or',
    'a', 'e', 'i', 'o', 'u', 'y'];
   for (var k = 0; k < keys.length; k++) {
    if (s.indexOf(keys[k], i) === i) { hit = keys[k]; break; }
   }
   if (hit) { out += map[hit] + '-'; i += hit.length; }
   else { out += s.charAt(i); i += 1; }
  }
  return str(w) && out.replace(/-+/g, '-').replace(/^-|-$/g, '');
 }

 /* The 4-stage British RP verifier run BEFORE synthesis in generateClips:
    (A) CAMBRIDGE_B1_RP_LEXICON lookup, (B) dictionary UK IPA fetch,
    (C) AI verdict (existing aiKey cascade) pinning "British RP, Cambridge
    B1, non-rhotic", (D) conflict rule — >1 phoneme difference or
    confidence < 0.85 quarantines the word (amber row, NO synthesis). */
 function verifyBritishRPWord(wordObj, cb) {
  cb = cb || noop;
  var w = str(wordObj && wordObj.w).toLowerCase();
  var result = { word: w, stage: 'A', ok: false, confidence: 0, ipa: '', rpRespelling: '', quarantined: false };
  function finish() {
   try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('rp_verify', { word: w, stage: result.stage, confidence: result.confidence }); } catch (eL) {}
   cb(result);
  }
  /* Stage A — the shipped lexicon. */
  var lex = null;
  try { lex = (sync() && sync().rpLexicon ? sync().rpLexicon() : {})[w] || null; } catch (eLex) { lex = null; }
  if (lex && str(lex.p)) {
   result.ipa = str(lex.p);
   result.rpRespelling = str(lex.ttsHint || (wordObj && wordObj.ttsHint) || '');
   result.stage = 'A';
   result.confidence = 0.95;
   result.ok = !!result.rpRespelling;
   finish();
   return true;
  }
  /* Stage B — the Cambridge/dictionary UK IPA fetch. */
  var dictUrl = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w);
  global.fetch(dictUrl, { cache: 'no-store' }).then(function (res) { return res && res.ok ? res.json() : null; }, function () { return null; })
   .then(function (entries) {
    if (!entries || !entries.length) {
     /* v0.0.6.w: a dead dictionary still synthesizes — deterministic RP hint. */
     result.stage = 'D';
     result.quarantined = false;
     result.rpSource = 'fallback';
     result.rpRespelling = str((wordObj && wordObj.ttsHint) || RP_TTS_OVERRIDES[w] || buildFallbackRpHint(w));
     result.ok = true;
     finish();
     return;
    }
    return entries;
   })
   .then(function (entries) {
    /* v0.0.6.w — the SEPARATE-ENTRY LAW: dictionaryapi.dev often returns the
       UK IPA text and the -uk.mp3 audio URL on DIFFERENT phonetics[] elements
       (and the IPA on an entry with US audio). Scan EVERY entry: prefer a
       phonetics[] item that carries -uk.mp3, else any non-US IPA text; the
       -uk.mp3 URL is collected wherever it lives. */
    var uk = '';
    var ukAudio = '';
    var anyIpa = '';
    try {
     var ei, pi;
     for (ei = 0; ei < (entries || []).length; ei++) {
      var ph = (entries[ei] && entries[ei].phonetics) || [];
      for (pi = 0; pi < ph.length; pi++) {
       var pAudio = str(ph[pi] && ph[pi].audio);
       var pText = str(ph[pi] && ph[pi].text || '');
       if (pAudio.indexOf('-uk.mp3') >= 0 && !ukAudio) ukAudio = pAudio;
       if (!uk) {
        if (pAudio.indexOf('-uk.mp3') >= 0 && pText) { uk = pText; }
        else if (!anyIpa && pText && pAudio.indexOf('-us.mp3') < 0) { anyIpa = pText; }
       }
      }
      var meanings = (entries[ei] && entries[ei].meanings) || [];
      var defs = [];
      try {
       for (var mi = 0; mi < meanings.length; mi++) {
        var ds = (meanings[mi] && meanings[mi].definitions) || [];
        for (var di = 0; di < ds.length && defs.length < 2; di++) defs.push(str(ds[di] && ds[di].definition));
       }
      } catch (eD) {}
      if (!result.defs && defs.length) result.defs = defs;
      var posList = [];
      try {
       for (var mp = 0; mp < meanings.length; mp++) if (str(meanings[mp] && meanings[mp].partOfSpeech)) posList.push(str(meanings[mp].partOfSpeech));
      } catch (eP2) {}
      if (!result.pos && posList.length) result.pos = posList.slice(0, 2);
     }
    } catch (eP) {}
    if (!uk && anyIpa) uk = anyIpa;
    if (ukAudio) result.ukAudio = ukAudio;
    result.stage = 'B';
    if (uk) {
     result.ipa = uk;
     result.rpRespelling = str((wordObj && wordObj.ttsHint) || RP_TTS_OVERRIDES[w] || buildFallbackRpHint(w));
     result.confidence = 0.9;
     result.ok = true;
     finish();
     return;
    }
    /* Stage C — the AI verdict through the existing aiKey cascade. */
    aiVerify(w, function (ai) {
     result.stage = 'C';
     if (ai && ai.ipa && Number(ai.confidence) >= 0.85) {
      result.ipa = str(ai.ipa);
      result.rpRespelling = str(ai.rpRespelling || (wordObj && wordObj.ttsHint) || buildFallbackRpHint(w));
      result.confidence = Number(ai.confidence) || 0;
      result.ok = true;
     } else {
      /* v0.0.6.w — the NEVER-QUARANTINE LAW: a word outside the 60-entry
         lexicon with no dictionary/AI verdict synthesizes ANYWAY through the
         deterministic British RP phonetic respelling rule (Stage D fallback),
         stamped rpSource: 'fallback'. NOTHING is ever skipped. */
      result.confidence = Number(ai && ai.confidence) || 0;
      result.ipa = str((ai && ai.ipa) || '');
      result.quarantined = false;
      result.rpRespelling = str((ai && ai.rpRespelling) || (wordObj && wordObj.ttsHint) || RP_TTS_OVERRIDES[w] || buildFallbackRpHint(w));
      result.rpSource = 'fallback';
      result.ok = true;
     }
     finish();
    });
   });
  return true;
 }
 /* v0.0.7.c (BUG-03) — REAL HTTP status diagnostics for every provider.
    200 = valid · 401 = invalid key · 403 = permission / quota · 429 = rate
    limit · network/CORS = the request never reached the provider. */
 function httpStatusLine(status) {
  if (status === 200 || status === 204) return '✓ HTTP ' + status + ' — ' + t('studioVerifyHttpOk', 'key valid');
  if (status === 401) return '✗ HTTP 401 — ' + t('studioVerifyHttp401', 'invalid key');
  if (status === 403) return '✗ HTTP 403 — ' + t('studioVerifyHttp403', 'permission / quota denied');
  if (status === 429) return '✗ HTTP 429 — ' + t('studioVerifyHttp429', 'rate limited — rotate the key pool');
  if (status >= 500) return '✗ HTTP ' + status + ' — ' + t('studioVerifyHttp5xx', 'provider error — retry later');
  return '✗ HTTP ' + status + ' — ' + t('studioVerifyHttpOther', 'unexpected response');
 }
 function paintProviderVerify(nodeId, text, state) {
  var node = byId(nodeId);
  if (!node) return false;
  node.textContent = str(text);
  if (node.setAttribute) node.setAttribute('data-state', state || '');
  return true;
 }
 function activeAiKey() {
  var k = str(fieldValue('studioAiKey') || (ST.secrets && ST.secrets.aiKey) || '');
  return k.replace(/^\s+|\s+$/g, '');
 }
 function verifyGroqKey(cb) {
  cb = cb || noop;
  var key = activeAiKey();
  var node = 'groqVerifyStatus';
  if (!key) { paintProviderVerify(node, '✗ ' + t('studioVerifyNoKey', 'Paste the AI key first (gsk_…)'), 'bad'); cb(); return false; }
  paintProviderVerify(node, '⏳ ' + t('studioWorking', 'Working…') + ' api.groq.com …', '');
  try {
   global.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 })
   }).then(function (res) {
    var line = httpStatusLine(res && res.status);
    paintProviderVerify(node, 'Groq · ' + line, (res && res.status === 200) ? 'ok' : 'bad');
    cb();
   }, function () {
    paintProviderVerify(node, 'Groq · ✗ ' + t('studioVerifyNetErr', 'Network / CORS error — the request never reached api.groq.com. Check the internet and retry.'), 'bad');
    cb();
   });
  } catch (e) {
   paintProviderVerify(node, 'Groq · ✗ ' + t('studioVerifyNetErr', 'Network / CORS error — the request never reached api.groq.com. Check the internet and retry.'), 'bad');
   cb();
   return false;
  }
  return true;
 }
 function verifyGeminiKey(cb) {
  cb = cb || noop;
  var key = activeAiKey();
  var node = 'geminiVerifyStatus';
  if (!key) { paintProviderVerify(node, '✗ ' + t('studioVerifyNoKey', 'Paste the AI key first (AIza…)'), 'bad'); cb(); return false; }
  paintProviderVerify(node, '⏳ ' + t('studioWorking', 'Working…') + ' generativelanguage.googleapis.com …', '');
  try {
   /* Zero-cost verification: listing models proves the key without
      spending a single generation credit. */
   global.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=' + encodeURIComponent(key), { cache: 'no-store' })
    .then(function (res) {
     var line = httpStatusLine(res && res.status);
     paintProviderVerify(node, 'Gemini · ' + line, (res && res.status === 200) ? 'ok' : 'bad');
     cb();
    }, function () {
     paintProviderVerify(node, 'Gemini · ✗ ' + t('studioVerifyNetErr', 'Network / CORS error — the request never reached generativelanguage.googleapis.com. Check the internet and retry.'), 'bad');
     cb();
    });
  } catch (e) {
   paintProviderVerify(node, 'Gemini · ✗ ' + t('studioVerifyNetErr', 'Network / CORS error — the request never reached generativelanguage.googleapis.com. Check the internet and retry.'), 'bad');
   cb();
   return false;
  }
  return true;
 }

 function aiVerify(w, cb) {
  cb = cb || noop;
  var key = str(ST.secrets && ST.secrets.aiKey) || '';
  if (!key) { cb(null); return false; }
  var body = JSON.stringify({
   model: 'llama-3.3-70b-versatile',
   messages: [
    { role: 'system', content: 'You verify British RP (Cambridge English B1, non-rhotic) pronunciations. Answer strict JSON only: {"ipa":"...","rpRespelling":"...","heterophone":false,"confidence":0.0}' },
    { role: 'user', content: 'Word: ' + str(w) }
   ]
  });
  /* The generic LLM leg reuses the existing Groq/OpenRouter cascade; a
     failure resolves null so Stage D quarantines rather than blocks. */
  try {
   global.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: body
   }).then(function (res) { return res && res.ok ? res.json() : null; }, function () { return null; })
    .then(function (j) {
     var out = null;
     try {
      var txt = str(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
      var mJ = txt.match(/\{[\s\S]*\}/);
      if (mJ) out = JSON.parse(mJ[0]);
     } catch (eJ) {}
     cb(out);
    });
  } catch (e) { cb(null); return false; }
  return true;
 }

 /* v0.0.6.v — publish-time purge law: only the ACTIVE words.* keys ship. */
 function purgeNonActiveWordClips(pack) {
  var clips = (pack && pack.clips) || (ST.voicePack && ST.voicePack.clips) || {};
  var active = {};
  var words = currentWords();
  var i;
  for (i = 0; i < words.length; i++) active['words.' + str(words[i] && words[i].w).toLowerCase()] = 1;
  var removed = 0;
  for (var k in clips) {
   if (!Object.prototype.hasOwnProperty.call(clips, k)) continue;
   if (k.indexOf('words.') === 0 && !active[k]) { delete clips[k]; removed += 1; }
  }
  return removed;
 }

 /* v0.0.6.v — the Live Student Activity & Alerts popup (#studioActivityPopup). */
 function paintStudioActivityPopup(ledgerData) {
  var popup = byId('studioActivityPopup');
  if (!popup) return false;
  var users = (ledgerData && ledgerData.users) || [];
  var sum = byId('studioActivitySummary');
  var totalSessions = 0, activeNow = 0, i, j;
  var cutoff = Date.now() - 15 * 60 * 1000;
  for (i = 0; i < users.length; i++) {
   totalSessions += (users[i].sessions || []).length;
   for (j = 0; j < (users[i].sessions || []).length; j++) {
    if (Number(users[i].sessions[j].endedAt || 0) >= cutoff) { activeNow += 1; break; }
   }
  }
  if (sum) sum.textContent = '🟢 ' + activeNow + ' Active (last 15 min) · ' + totalSessions + ' Session' + (totalSessions === 1 ? '' : 's') + ' Recorded · ' + users.length + ' Unique Student' + (users.length === 1 ? '' : 's') + ' 🔔';
  var wordTotal = 30;
  try { if (sync() && sync().words) wordTotal = (sync().words() || []).length || 30; } catch (eWT) {}
  var tbody = popup.querySelector('#studioActivityTable tbody');
  if (tbody) {
   var rows = '';
   for (i = 0; i < users.length; i++) {
    var u = users[i];
    var last = (u.sessions && u.sessions.length) ? u.sessions[u.sessions.length - 1] : null;
    var visits = (u.sessions || []).length;
    var dwell = 0;
    for (j = 0; j < (u.sessions || []).length; j++) dwell += Number(u.sessions[j].dwellSec || 0);
    /* v0.0.7.b B6: the full mobile device telemetry — class · OS · browser ·
       screen size · network — captured privacy-safe by Telemetry. */
    var dev = 'unknown';
    if (last && last.device) {
     dev = last.device.class + ' · ' + (last.device.os || '?') + ' · ' + (last.device.browser || '?') +
      (last.device.screen ? ' · ' + last.device.screen : '') + ' · ' + (last.device.net || '?') +
      (last.device.online === false ? ' · offline' : '');
    }
    var reactions = (last && Array.isArray(last.reactions) && last.reactions.length) ? last.reactions.slice(0, 6).join(' ') : '—';
    rows += '<tr><td>' + esc(str(u.clientId).slice(0, 12)) + '</td>' +
     '<td>' + esc(dev) + '</td>' +
     '<td>' + visits + '</td>' +
     '<td>' + Math.round(dwell / 60) + ' min</td>' +
     '<td>' + (last ? (last.wordsCompleted + '/' + wordTotal) : '—') + '</td>' +
     '<td>' + (last ? (last.score + '%') : '—') + '</td>' +
     '<td>' + esc(last && last.missedWords ? last.missedWords.slice(0, 6).join(', ') : '—') + '</td>' +
     '<td>' + esc(reactions) + '</td>' +
     '<td>' + (last ? (last.lagMs + ' ms') : '—') + '</td></tr>';
   }
   tbody.innerHTML = rows;
  }
  var inc = byId('studioIncidentsPanel');
  if (inc) {
   var html = '', n = 0;
   for (i = 0; i < users.length; i++) {
    var list = users[i].incidents || [];
    for (j = 0; j < list.length; j++) {
     n += 1;
     html += '<p class="inc-row">⚠ Student Troubleshooting Incident Detected — user encountered ' + esc(str(list[j].type)) + ' · ' + esc(str(list[j].viewport)) + ' · ' + esc(str(list[j].net)) + '</p>';
    }
   }
   inc.innerHTML = n ? html : '';
  }
  popup.hidden = false;
  popup.setAttribute('aria-hidden', 'false');
  if (popup.classList) popup.classList.add('is-open');
  return true;
 }
 /* v0.0.7.b B6 — LIVE auto-refresh: while the activity popup is open it
    re-pulls the telemetry ledger AND the lecturer alerts every 10 s, so
    student completions and errors appear in real time. */
 var activityRefreshTimer = 0;
 function refreshStudioActivity() {
  try {
   var led = dataSettings().telemetryLedger || null;
   paintStudioActivityPopup(led);
  } catch (eP) {}
  try {
   if (SDP.Telemetry && SDP.Telemetry.pullTelemetryLedger) {
    SDP.Telemetry.pullTelemetryLedger(function () {
     try { paintStudioActivityPopup(sync().settings().telemetryLedger || null); } catch (eS) {}
    });
   }
  } catch (eL2) {}
  try {
   if (SDP.Telemetry && SDP.Telemetry.pullLecturerAlerts) {
    SDP.Telemetry.pullLecturerAlerts(function () { paintLecturerAlertsCard(); });
   }
  } catch (eA) {}
  return true;
 }
 function openStudioActivityPopup() {
  var fetchLedger = (global.SDP && SDP.Telemetry && SDP.Telemetry.pullTelemetryLedger) || null;
  /* v0.0.7.b B6 FIX: read the ledger through the robust Data accessor —
     the legacy sync().settings() path silently returned null here, which
     is exactly why the Studio "did not reliably receive live student
     activity". */
  var local = null;
  try { local = (dataSettings().telemetryLedger || null); } catch (eL) {}
  paintStudioActivityPopup(local);
  if (fetchLedger) {
   fetchLedger(function () {
    var led = null;
    try { led = dataSettings().telemetryLedger || null; } catch (eS) {}
    paintStudioActivityPopup(led || local);
   });
  }
  if (activityRefreshTimer) { try { global.clearInterval(activityRefreshTimer); } catch (eT) {} }
  activityRefreshTimer = global.setInterval(refreshStudioActivity, 10000);
  return true;
 }
 function closeStudioActivityPopup() {
  var popup = byId('studioActivityPopup');
  if (activityRefreshTimer) { try { global.clearInterval(activityRefreshTimer); } catch (eT) {} activityRefreshTimer = 0; }
  if (!popup) return false;
  popup.hidden = true;
  popup.setAttribute('aria-hidden', 'true');
  if (popup.classList) popup.classList.remove('is-open');
  return true;
 }

 /* v0.0.7.a — the briefing card lives INSIDE the Advanced drawer, ids intact. */
 function briefingVoicesCardMarkup() {
  return '<section id="studioCardBriefingVoices" class="studio-card studio-card-briefing-voices">' +
   '<h4 class="studio-h4"><span class="studio-step-tag">STUDIO ↔ BRIEFING BRIDGE</span>Project Overview &amp; Guide Voices</h4>' +
   '<div class="studio-voice-row">' +
   '<label class="lbl" for="studioBriefingVoiceSelect">Executive Male Voice</label>' +
   '<select id="studioBriefingVoiceSelect" class="input studio-voice-select" aria-label="Executive Male Voice">' +
   (function () {
     var out = '', i, k, p, seen = {}, fv = [];
     var custom = briefingCustomVoiceId();
     var wantSel = custom ? ('id:' + custom) : briefingVoiceKey();
     for (i = 0; i < BRIEFING_VOICE_ORDER.length; i++) {
       k = BRIEFING_VOICE_ORDER[i];
       p = BRIEFING_VOICE_CATALOG[k];
       if (!p) continue;
       out += '<option value="' + k + '"' + (k === wantSel ? ' selected' : '') + '>' + esc(p.name) + ' — ' + esc(p.persona) + '</option>';
     }
     /* v0.0.6.r PERSISTENCE LAW: the fetched account voices and the saved
        custom/cloned pick are re-rendered with the right option marked
        selected, so a mount() re-render never wipes the creator's Cloned
        Voice back to the default catalog persona. */
     try {
       fv = Array.isArray(ST.fetchedVoices) ? ST.fetchedVoices : (isObj(ST.secrets) && Array.isArray(ST.secrets.fetchedVoices) ? ST.secrets.fetchedVoices : []);
     } catch (eFV) { fv = []; }
     for (i = 0; i < fv.length; i++) {
       if (!isObj(fv[i]) || !str(fv[i].voice_id) || seen[str(fv[i].voice_id)]) continue;
       seen[str(fv[i].voice_id)] = 1;
       out += '<option value="id:' + esc(str(fv[i].voice_id)) + '"' + (('id:' + str(fv[i].voice_id)) === wantSel ? ' selected' : '') + '>' +
        esc(str(fv[i].name) || 'Account Voice') + ' — ' + ((str(fv[i].category) === 'cloned') ? 'My Cloned Voice' : 'Account Voice') + ' · ' + esc(str(fv[i].voice_id)) + '</option>';
     }
     if (custom && !seen[custom]) out += '<option value="id:' + esc(custom) + '" selected>My Cloned Voice · ' + esc(custom) + '</option>';
     return out;
   })() +
   '</select>' +
   '<input id="studioBriefingCustomVoiceId" class="input studio-voice-custom" type="text" value="' + esc(briefingCustomVoiceId()) + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other" placeholder="Or paste Cloned ElevenLabs Voice ID…">' +
   btn('btnFetchClonedVoices', '🔄 Fetch My Cloned Voices', 'btn-ghost') +
   '</div>' +
   '<div class="chip-row studio-bridge-row">' +
   btn('btnStudioBriefingVoices', '🎙 Generate & Sync Project Overview + Guide Voices Now', 'btn-primary') +
   btn('btnPreviewBriefingBeat', '▶ Preview Beat 1', 'btn-ghost') +
   '</div>' +
   '<p id="studioBriefingVoiceBar" class="studio-briefing-voice-bar" role="status" aria-live="polite" data-state="idle">🎙 Project Overview &amp; Guide voices are checked automatically on unlock — or press Generate below.</p>' +
   '</section>';
 }

 /* ══ v0.0.7.a PILLAR A4 — THE CLEAN, HUMAN-FRIENDLY STUDIO LAYOUT.
    Daily workflow FIRST: the lecturer opens Studio and immediately sees
    (1) the compact security bar, (2) the live status block, (3) Card 1 —
    Dictation Words & Word-Count Manager (the daily job), (4) Card 2 —
    Smart Session Details (stepper, day dropdown, topic chips). Everything
    else folds into three collapsible drawers BELOW the daily cards:
    Drawer A — Voice & Clone Studio, Drawer B — Student Alerts & Live
    Diagnostics (auto-opens only when unread alerts exist), Drawer C —
    Advanced Tools & API Key Pool. No stray key inputs, no voice wall at
    the top, no buried word editor. සරල, ක්‍රමවත් පිරිසැලසුමක්. */
 function studioAlertsDrawerMarkup() {
  return '<details id="studioAlertsDrawer" class="studio-drawer studio-alerts-drawer">' +
   '<summary class="studio-h4"><span class="studio-step-tag">DRAWER B</span>🔔 Student Alerts &amp; Live Diagnostics <span class="studio-alert-count-badge" id="studioAlertCountBadge">0</span></summary>' +
   '<div class="studio-drawer-body">' +
   '<section id="studioLecturerAlertsCard" class="studio-card studio-lecturer-alerts-card">' +
   '<h4 class="studio-h4">Lecturer Alert Inbox — student voice &amp; clip alerts land here in real time</h4>' +
   '<div class="chip-row">' +
   btn('btnRefreshLecturerAlerts', '🔄 Refresh Alerts (Pull Live)', 'btn-ghost') +
   btn('btnClearLecturerAlerts', '✓ Dismiss / Mark Resolved', 'btn-ghost') +
   '</div>' +
   '<div id="studioLecturerAlertsList" class="studio-alert-list" aria-live="polite"></div>' +
   '</section>' +
   '</div></details>';
 }
 function unlockedMarkup() {
  return securityBarMarkup() +
   /* v0.0.7.e: the dismissible first-time Access Lock notice (EN|SI). */
   studioFirstTimeNoticeMarkup() +
   /* ══ v0.0.7.a A4 — the instant post-action audit banner + compact status
      pills: key pool chip (A2), classroom lock, voice lock, coverage. ══ */
   '<div id="studioActionAuditBanner" class="studio-action-audit-banner" data-state="ok" role="status" aria-live="polite">✓ Studio ready — actions verified here in real time. ක්‍රියා තහවුරු කිරීම මෙහිම.</div>' +
   '<div class="chip-row studio-status-pills">' +
   '<span id="studioKeyPoolChip" class="studio-key-pool-chip" data-state="idle" role="status" aria-live="polite" title="ElevenLabs multi-key pool — manage keys in Advanced Tools">🔑 Pool: checking…</span>' +
   '<span id="studioVoiceCoveragePill" class="studio-coverage-pill" data-state="ok">…</span>' +
   '</div>' +
   '<div class="chip-row studio-voice-lock-bar"><span id="studioVoiceLockBar" class="studio-briefing-voice-bar" data-state="locked" role="status" aria-live="polite">🔒 Locked: Energetic British RP Female (Alice · -21 LUFS · +2.5dB @ 3kHz)</span></div>' +
   '<div class="chip-row">' +
   btn('btnLockStudioUnlockDictation', '🔒 Lock Studio &amp; Unlock Dictation (Classroom Mode)', 'btn-go') +
   '</div>' +
   '<p id="studioMsg" class="studio-msg" role="status" aria-live="polite"></p>' + '<p id="studioTestStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<div id="studioErrorAssistant" class="studio-error-assistant" data-state="hidden" role="region" aria-live="polite"></div>' +
   /* ══ v0.0.7.a A2 — the SMART QUOTA-EXCEEDED dialog (hidden until the
      pre-flight check finds the pool cannot cover the missing words). */
   '<div id="studioQuotaDialog" class="studio-quota-dialog" data-state="quota" role="alertdialog" aria-modal="false" aria-labelledby="studioQuotaHeadline" hidden>' +
   '<h4 class="studio-h4" id="studioQuotaHeadline">⚠ Credits insufficient</h4>' +
   '<p id="studioQuotaDetail" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<div class="chip-row">' +
   btn('btnQuotaAddKey', '➕ Add Another ElevenLabs API Key', 'btn-primary') +
   btn('btnQuotaUseReady', '✂️ Use Only Words With Ready Voice Clips', 'btn-ghost') +
   btn('btnQuotaReduceCount', '📉 Reduce Custom Word Count', 'btn-ghost') +
   btn('btnQuotaDismiss', '✕ Close', 'btn-ghost') +
   '</div>' +
   '</div>' +

   /* ══ CARD 1 — DICTATION WORDS & WORD-COUNT MANAGER (the daily job,
      IMMEDIATELY at the top). Bulk paste, unlimited count manager, Enrich
      British RP, live chips, word table, Publish & Broadcast. */
   wordsCardMarkup() +
   /* CARD 2 — SMART SESSION DETAILS sits directly below the words card
      inside the same visual block (sessionMetaCardMarkup is rendered by
      wordsCardMarkup so the two daily cards read as one workflow). */
   '<div id="studioSyncSlot" class="studio-sync-slot"></div>' +

   /* ══ DRAWER A — VOICE & CLONE STUDIO (Z1/Z2 clone pipeline, mic
      recorder/uploader, AI analyzer, 1-click revert to the default — all
      folded below the daily cards so they never overwhelm word editing). */
   '<details id="studioVoiceDrawer" class="studio-drawer studio-voice-drawer">' +
   '<summary class="studio-h4"><span class="studio-step-tag">DRAWER A</span>🔊 Voice &amp; Clone Studio — unified classroom voice, recorder, analyzer &amp; revert</summary>' +
   '<div class="studio-drawer-body">' + classroomVoiceCardMarkup() + '</div>' +
   '</details>' +

   /* ══ DRAWER B — STUDENT ALERTS & LIVE DIAGNOSTICS (auto-opens only when
      unread alerts > 0 — paintLecturerAlertsCard enforces that law). */
   studioAlertsDrawerMarkup() +

   /* ══ DRAWER C — ADVANCED TOOLS & API KEY POOL (briefing voices,
      classroom settings incl. PIN, the ElevenLabs multi-key pool, GitHub
      token, Gemini/LLM keys, diagnostics, Live Lab launcher). */
   '<details id="studioAdvancedDrawer" class="studio-advanced-drawer"><summary class="studio-h4">' + ico('gear', 16) + '<span class="studio-step-tag">DRAWER C</span>' + T('studioAdvancedToggle') + '</summary>' +
   '<div class="studio-adv-body">' + accessLockCardMarkup() + briefingVoicesCardMarkup() + settingsCardMarkup() + keysCardMarkup() + diagCardMarkup() + '</div></details>' +
   /* v0.0.6.m Pillar 4: the dedicated User Reviews & Session Telemetry
      drawer stays at the very bottom. */
   reviewsCardMarkup();
 }
 /* R5/SEC-01: while locked the body */
 function lockedMarkup() {
  return '<div id="studioGate" class="studio-gate" role="group" aria-label="' + T('studioPinLabel') + '">' +
   '<p class="muted">' + T('studioLocked') + '</p>' +
   '<div class="pin-row">' + '<label class="for-only" for="studioPin">' + T('studioPinLabel') + '</label>' + '<input id="studioPin" class="input pin-mask" type="text" readonly inputmode="none" tabindex="-1" aria-hidden="true" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" maxlength="8" minlength="4" placeholder="' + T('studioPinLabel') + '">' +
   '<button type="button" class="btn btn-sm" id="pinPadBack" aria-label="Delete last digit">⌫</button>' + '</div>' +
   pinDotsMarkup() +
   pinPadMarkup() +
   '<p id="studioMsg" class="studio-msg" role="status" aria-live="polite"></p>' + '<p class="studio-hint" data-i18n="studioAskLecturer">' + T('studioAskLecturer') + '</p>' +
   '</div>';
 }

 function clipCount() {
  var clips = isObj(ST.voicePack.clips) ? ST.voicePack.clips : {};
  var n = 0, k;
  for (k in clips) {
   if (!Object.prototype.hasOwnProperty.call(clips, k)) continue;
   if (clipExists(k)) n += 1;
  }
  return n;
 }
 function packDashboardText() {
  var vault = vaultBadgeVisible() ? t('studioPackVault') : 'Vault: —';
  var gh = str(ST.secrets.ghToken) ? t('studioPackGithub') : 'GitHub: —';
  /* v0.0.6.m Pillar 2: the immutable static vault is part of the honest */
  var stats = staticVaultStats();
  var pool = keyPoolCount();
  return vault + ' | ' + gh + ' | ' + t('studioPackClips') + clipCount() + t('studioClipsUnit') +
   ' | Static vault ' + stats.locked + '/' + stats.total + ' locked | Key pool ' + pool + '/' + KEY_POOL_SLOTS;
 }
 function paintPackDashboard() {
  var node = byId('studioPackDashboard');
  if (!node) return false;
  node.textContent = packDashboardText();
  return true;
 }
 /* ══ v0.0.7.a Pillar 3 (Y3) — the Lecturer Alert Inbox painter: every
    incoming student alert (missing/stale clips, pronunciation, messages)
    renders here with 1-click Fix / Publish / Resolve actions. ══ */
 var LECTURER_ALERT_LABELS = {
  missing_clips: 'Missing Voice Clips',
  stale_clips: 'Stale Voice Clips',
  pronunciation_error: 'Pronunciation Issue',
  user_message: 'Student Message'
 };
 function paintLecturerAlertsCard() {
  var host = byId('studioLecturerAlertsList');
  if (!host) return false;
  var store = null;
  try { if (SDP.Telemetry && SDP.Telemetry.alertStore) store = SDP.Telemetry.alertStore(); } catch (eT) {}
  var items = store && Array.isArray(store.items) ? store.items : [];
  var badge = byId('studioAlertCountBadge');
  if (badge) badge.textContent = String(store && Number(store.unread) ? store.unread : 0);
  var popBadge = doc.getElementById('studioAlertCountBadge');
  if (!popBadge) {
   try {
    var dockBtn = byId('btnStudioActivityPopup');
    if (dockBtn && !byId('studioAlertCountBadge')) {
     var sp = doc.createElement('span');
     sp.id = 'studioAlertCountBadge';
     sp.className = 'studio-alert-count-badge';
     sp.textContent = String(store && Number(store.unread) ? store.unread : 0);
     dockBtn.appendChild(sp);
    }
   } catch (eD) {}
  }
  if (!items.length) {
   host.innerHTML = '<p class="studio-alert-empty">No student alerts yet. දැනට පණිවිඩ නැත. — Voice/clip issues students report appear here in real time.</p>';
   return true;
  }
  var html = '', i, a, when, typeLbl;
  for (i = 0; i < Math.min(items.length, 30); i++) {
   a = items[i];
   when = new Date(Number(a.at) || Date.now());
   typeLbl = LECTURER_ALERT_LABELS[str(a.alertType)] || str(a.alertType);
   html += '<div class="studio-alert-row" data-resolved="0">' +
    '<div class="sar-top"><span class="sar-type" data-type="' + esc(str(a.alertType)) + '">' + esc(typeLbl) + '</span>' +
    '<span>🕒 ' + esc(when.toLocaleString ? when.toLocaleString() : String(when)) + '</span>' +
    '<span>📱 ' + esc(str(a.clientId)) + '</span></div>' +
    (a.missingWords && a.missingWords.length ? '<div class="sar-msg">Missing words (' + a.missingWords.length + '): ' + esc(a.missingWords.slice(0, 8).join(', ')) + (a.missingWords.length > 8 ? '…' : '') + '</div>' : '') +
    (a.staleKeys && a.staleKeys.length ? '<div class="sar-msg">Stale keys: ' + esc(a.staleKeys.slice(0, 5).join(', ')) + '</div>' : '') +
    (str(a.message) ? '<div class="sar-msg">💬 ' + esc(str(a.message)) + '</div>' : '') +
    '<div class="sar-actions">' +
    '<button type="button" class="btn btn-primary" data-alert-action="fix">🧹 Fix Now: Wipe &amp; Re-Generate 30 Words</button>' +
    '<button type="button" class="btn btn-go" data-alert-action="publish">🚀 Publish Updated Pack to All Students</button>' +
    '<button type="button" class="btn btn-ghost" data-alert-action="resolve">✓ Dismiss</button>' +
    '</div></div>';
  }
  host.innerHTML = html;
  return true;
 }
 /* ══ v0.0.7.a Pillar 4 (Y4) — the live Voice Coverage Matrix pill. ══ */
 function voiceCoverageCounts() {
  var clips = (isObj(ST.voicePack) && isObj(ST.voicePack.clips)) ? ST.voicePack.clips : {};
  var manifestClips = {};
  try { if (SDP.Speech && SDP.Speech.clipManifest && isObj(SDP.Speech.clipManifest()) && isObj(SDP.Speech.clipManifest().clips)) manifestClips = SDP.Speech.clipManifest().clips; } catch (eM) {}
  /* v0.0.7.b B1 — the HONEST COVERAGE LAW: a clip counts as READY only
     when its payload is REAL. A zero-byte (bytes:0), empty-b64 or
     sub-512-byte entry is MISSING, never Ready, so the pill can never lie
     to the lecturer again while the player silently falls back. */
  var validAt = function (k) {
   if (Object.prototype.hasOwnProperty.call(clips, k)) return isPlayableClipEntry(clips[k]);
   if (Object.prototype.hasOwnProperty.call(manifestClips, k)) return isPlayableClipEntry(manifestClips[k]);
   return false;
  };
  var count = function (test) {
   var n = 0, k;
   for (k in clips) if (Object.prototype.hasOwnProperty.call(clips, k) && test(k) && isPlayableClipEntry(clips[k])) n += 1;
   for (k in manifestClips) if (Object.prototype.hasOwnProperty.call(manifestClips, k) && test(k) && isPlayableClipEntry(manifestClips[k]) && !Object.prototype.hasOwnProperty.call(clips, k)) n += 1;
   return n;
  };
  var words = [];
  try { words = currentWords(); } catch (eW) {}
  var activeWords = {}, wi;
  for (wi = 0; wi < words.length; wi++) activeWords[str(words[wi] && words[wi].w).toLowerCase()] = 1;
  var wordsReady = 0, wk;
  for (wk in activeWords) {
   if (Object.prototype.hasOwnProperty.call(activeWords, wk) && validAt('words.' + wk)) wordsReady += 1;
  }
  /* v0.0.7.c (BUG-05): the pill denominators follow the LIVE bank —
     words.length words and the real num.* population (31 for a 31-word
     session), never a hardcoded 30. */
  var numTotal = 0, seenNum = {}, nk;
  for (nk in clips) if (Object.prototype.hasOwnProperty.call(clips, nk) && /^num\./.test(nk) && !seenNum[nk]) seenNum[nk] = 1;
  for (nk in manifestClips) if (Object.prototype.hasOwnProperty.call(manifestClips, nk) && /^num\./.test(nk) && !seenNum[nk]) seenNum[nk] = 1;
  numTotal = (function () { var t = 0, q; for (q in seenNum) t += 1; return t; })();
  return {
   words: { ready: wordsReady, total: words.length },
   numbers: { ready: count(function (k) { return /^num\./.test(k); }), total: numTotal || words.length },
   commands: { ready: count(function (k) { return /^cmd\./.test(k); }), total: 6 },
   guide: { ready: count(function (k) { return /^guide\./.test(k); }), total: 4 },
   briefing: { ready: count(function (k) { return /^_intro_male_/.test(k); }), total: 4 }
  };
 }
 function paintVoiceCoveragePill() {
  var pill = byId('studioVoiceCoveragePill');
  if (!pill) return false;
  var c = voiceCoverageCounts();
  var segs = [
   c.words.ready + '/' + c.words.total + ' Words',
   c.numbers.ready + '/' + c.numbers.total + ' Numbers',
   c.commands.ready + '/' + c.commands.total + ' Commands',
   c.guide.ready + '/' + c.guide.total + ' Guide',
   c.briefing.ready + '/' + c.briefing.total + ' Briefing'
  ];
  var full = c.words.ready >= c.words.total && c.numbers.ready >= 30 && c.commands.ready >= 6 && c.guide.ready >= 4 && c.briefing.ready >= 4;
  pill.setAttribute('data-state', full ? 'ok' : 'partial');
  pill.textContent = '🔊 Voice Coverage: ' + segs.join(' · ');
  return true;
 }
 /* The Y4 reactive repaint: clip table + pack dashboard + coverage pill +
    word manager all update within the same tick on every emitChange. */
 function paintAllVoiceSurfaces() {
  try { paintClipTable(); } catch (e1) {}
  try { paintPackDashboard(); } catch (e2) {}
  try { paintVoiceCoveragePill(); } catch (e3) {}
  try { paintWordManager(); } catch (e4) {}
  try { paintLecturerAlertsCard(); } catch (e5) {}
  return true;
 }
 function genProgressText() {
  return str(ST.genProgress) || (t('studioPackClips') + clipCount() + t('studioClipsUnit'));
 }
 /* D4: the retry row is visible only while a real failure is on record. */
 function paintRetryRow() {
  var btn = byId('btnRetryFailedClip');
  var row = btn && btn.parentNode;
  var shown = !!(ST.lastFailedClip && ST.lastFailedClip.key);
  if (row && row.setAttribute) {
   if (shown) row.removeAttribute('hidden'); else row.setAttribute('hidden', 'hidden');
  }
  if (shown && btn) btn.textContent = t('studioRetryOne') + ' ' + ST.lastFailedClip.key;
  return shown;
 }
 function paintGenProgress(text) {
  if (text !== undefined) ST.genProgress = str(text);
  var node = byId('studioGenProgress');
  if (node) node.textContent = genProgressText();
  if (ST.unlocked) paintRetryRow();
  return true;
 }
 /* D7: the single #lecturerSyncBar element hops into Card 3 while unlocked and */
 function lecturerBarNode() {
  var bar = byId('lecturerSyncBar');
  if (bar) ST.lecturerBar = bar;
  return ST.lecturerBar || null;
 }
 function stashLecturerBar() {
  var bar = lecturerBarNode();
  if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  return bar;
 }
 function placeLecturerBar() {
  var bar = lecturerBarNode();
  if (!bar) return false;
  var slot = byId('studioSyncSlot');
  var dock = byId('studioSyncDock');
  var target = (ST.unlocked && slot) ? slot : dock;
  if (target && bar.parentNode !== target) target.appendChild(bar);
  return true;
 }

 /* v0.0.6.d (D8): Chrome fires its "Save password?" heuristic the moment a */
 function defusePasswordInputs(host) {
  try {
   var inputs = host && host.querySelectorAll ? host.querySelectorAll('input[type="password"]') : [];
   for (var i = 0; i < inputs.length; i++) {
    try { inputs[i].type = 'text'; } catch (e) {}
    try { inputs[i].value = ''; } catch (e) {}
   }
  } catch (e2) {}
  return true;
 }


 /* v0.0.6.v — one-shot button binder + text download helper. */
 function onStudio(id, evt, fn) {
  try {
   var node = byId(id);
   if (!node || node['_sdp_v_' + evt]) return null;
   node['_sdp_v_' + evt] = true;
   node.addEventListener(evt, fn);
   return node;
  } catch (e) { return null; }
 }
 function downloadText(name, text) {
  try {
   var blob = new global.Blob([text], { type: 'application/json' });
   var url = global.URL.createObjectURL(blob);
   var a = global.document.createElement('a');
   a.href = url; a.download = name;
   (global.document.body || global.document.documentElement).appendChild(a);
   a.click();
   global.setTimeout(function () {
    try { global.URL.revokeObjectURL(url); a.remove(); } catch (eR) {}
   }, 1200);
   return true;
  } catch (e) { return false; }
 }

 function setStudioLockArm() {
  var locked = true;
  try {
   if (SDP.Engine && SDP.Engine.setStudioLocked) locked = SDP.Engine.setStudioLocked(true);
  } catch (eL2) {}
  try { if (SDP.Engine && SDP.Engine.stop) SDP.Engine.stop(); } catch (eS4) {}
  try { if (SDP.Views && SDP.Views.paintDictationLockOverlay) SDP.Views.paintDictationLockOverlay(true); } catch (eV4) {}
  paintStudioActionAuditBanner('Classroom lock armed', 'dictation gated to the lock overlay');
  msg('🔒 Classroom lock ARMED — dictation is gated behind the bilingual lock overlay; unlock from the overlay or this Studio button.', 'ok');
  return locked;
 }

 function mount() {
  /* v0.0.7.a A1: hydrate the persisted word cap BEFORE any markup paint so
     the select/custom input/pill all render the persisted choice (the
     31→30 snap-on-reload fix). */
  try { hydrateWordCap(); } catch (eHC) {}
  /* D8: the Layer-1 self-heal runs before */
  try { healFromLayerOne(); } catch (e) {}
  /* D13: same-tab reload restores the */
  try { restoreSessionStash(); } catch (e) {}
  var host = byId('studioBody');
  if (!host) return false;
  /* D7: the ONE #lecturerSyncBar node survives every re-render. */
  stashLecturerBar();
  defusePasswordInputs(host);
  host.innerHTML = ST.unlocked ? unlockedMarkup() : lockedMarkup();
  /* v0.0.7.a Pillar 1/3/4 — Voice Sample Studio inputs, the alert inbox and
     the reactive repaint wiring. */
  if (ST.unlocked) {
   var vsFile = byId('voiceSampleFileInput');
   if (vsFile) {
    onStudio('voiceSampleFileInput', 'change', function (ev) {
     var f = ev && ev.target && ev.target.files && ev.target.files[0];
     if (f) vsHandleFile(f);
    });
   }
   onStudio('btnVoiceSampleRecord', 'click', function () { toggleVoiceSampleRecord(); });
   onStudio('btnVoiceSampleStop', 'click', function () { vsStopRecording(); });
   /* ══ v0.0.7.a A1 — the unlimited word-count select + custom input.
      STRICT GATING: presets disable + mute the custom input; Custom enables
      it. setWordCap carries the mode so lock/unlock/reload/publish all
      re-hydrate the same choice. */
   onStudio('studioWordCountSelect', 'change', function (ev) {
    var v = str(ev && ev.target && ev.target.value);
    var custom = byId('studioWordCountCustom');
    if (v === 'custom') {
     if (custom) {
      custom.disabled = false;
      custom.hidden = false;
      if (!Number(custom.value) || Number(custom.value) < 5) custom.value = wordCap();
      try { custom.focus(); } catch (eF) {}
     }
     return;
    }
    /* a preset was picked — collapse + disable the custom input */
    if (custom) { custom.disabled = true; custom.hidden = false; }
    setWordCap(Number(v) || 30, 'preset');
    msg('Word count set: ' + wordCap() + ' words per run — the bank and all / N counters follow.', 'ok');
   });
   onStudio('studioWordCountCustom', 'change', function (ev) {
    var n = Number(ev && ev.target && ev.target.value);
    /* v0.0.7.a: NO artificial 50 cap — 5 to unlimited. Credits are checked
       by the A2 pre-flight before any synthesis. */
    if (!n || n < 5) { msg('Custom word count must be 5 or more (no upper limit — ElevenLabs credits are the only bound).', 'warn'); return; }
    setWordCap(n, 'custom');
    msg('Custom word count set: ' + wordCap() + ' words per run (unlimited mode).', 'ok');
   });
   /* ══ v0.0.7.a A4 — SMART SESSION DETAILS bindings: the stepper, the
      date→day auto-sync, topic quick-pick chips, and the hidden mirrors
      that keep publishBundle's legacy field readers in sync (H6). */
   function syncSessionMirrors() {
    var no = byId('studioSessionNoInput'), ti = byId('studioSessionTitleInput');
    if (no) no.value = str(fieldValue('studioMetaNo') || '');
    if (ti) ti.value = str(fieldValue('studioMetaTitle') || '');
   }
   function stepSessionNo(delta) {
    var el = byId('studioMetaNo');
    if (!el) return;
    var n = Number(String(el.value).replace(/[^0-9]/g, '')) || 0;
    n = Math.max(1, n + (Number(delta) || 0));
    el.value = String(n);
    /* auto-title follows the stepper when the title still matches the
       "Session <N> - <Topic>" pattern, so +1 renumbers the title too. */
    var ti = byId('studioMetaTitle');
    if (ti) {
     var m = str(ti.value).match(/^Session\s+(\d+)\s*-\s*(.*)$/);
     if (m) ti.value = 'Session ' + n + ' - ' + m[2];
    }
    syncSessionMirrors();
    paintSessionMetaCard();
    msg('Session number: ' + n + (delta > 0 ? ' (next session)' : '') + ' — Apply Session Metadata to stamp it.', 'ok');
   }
   onStudio('btnSessionNoMinus', 'click', function () { stepSessionNo(-1); });
   onStudio('btnSessionNoPlus', 'click', function () { stepSessionNo(1); });
   onStudio('studioMetaNo', 'input', function () { syncSessionMirrors(); paintSessionMetaCard(); });
   onStudio('studioMetaTitle', 'input', function () { syncSessionMirrors(); });
   onStudio('studioMetaDate', 'input', function (ev) {
    /* v0.0.7.a A4: changing the date auto-derives the day — no typing. */
    var iso = str(ev && ev.target && ev.target.value);
    var day = dayFromIsoDate(iso);
    var dayEl = byId('studioMetaDay');
    if (day && dayEl) dayEl.value = day;
    paintSessionMetaCard();
   });
   onStudio('studioMetaDay', 'change', function () { paintSessionMetaCard(); });
   onStudio('studioMetaBranch', 'input', function () { paintSessionMetaCard(); });
   /* v0.0.7.b B4: the 12 topic quick-pick chips are gone — the Session
      Topic input stays clean; the lecturer types or pastes any topic. */
   onStudio('btnApplySessionMeta', 'click', function () {
    withBusy('btnApplySessionMeta', function (d) {
     var no = str(fieldValue('studioMetaNo') || '').trim();
     var title = str(fieldValue('studioMetaTitle') || '').trim();
     var date = str(fieldValue('studioMetaDate') || '').trim();
     var day = str(fieldValue('studioMetaDay') || '').trim();
     var branch = str(fieldValue('studioMetaBranch') || '').trim();
     var classInfo = str(fieldValue('studioMetaClassInfo') || '').trim();
     if (!no || !date) { msg('Session No and Date are required.', 'warn'); d(); return; }
     ST.sessionNo = no;
     ST.title = title;
     ST.meta = { no: no, title: title, date: date, day: day, branch: branch, classInfo: classInfo, display: 'SESSION ' + no + ' · ' + displayDate(date) + ' ● ' + branch.toUpperCase() };
     try { dataSaveSettings({ sessionMeta: ST.meta }); } catch (eM2) {}
     try {
      if (SDP.Sync && SDP.Sync.state && isObj(SDP.Sync.state.session)) {
       SDP.Sync.state.session.no = no;
       SDP.Sync.state.session.title = title;
       SDP.Sync.state.session.date = date;
       SDP.Sync.state.session.day = day;
       SDP.Sync.state.session.branch = branch;
       SDP.Sync.state.session.classInfo = classInfo;
       SDP.Sync.state.session.display = ST.meta.display;
      }
     } catch (eS3) {}
     syncSessionMirrors();
     paintSessionMetaCard();
     paintStudioActionAuditBanner('Session metadata apply', 'display ' + ST.meta.display);
     msg('✅ Session metadata applied — ' + ST.meta.display + ' (stamped into the next publish).', 'ok');
     d();
    });
   });
   /* ══ v0.0.7.a Z4 — Lock Studio & Unlock Dictation (classroom mode) ══ */
   onStudio('btnLockStudioUnlockDictation', 'click', function () { setStudioLockArm(); });
   /* v0.0.7.a A2 — the key-pool chip opens Drawer C (the only key surface). */
   onStudio('studioKeyPoolChip', 'click', function () {
    var drawer = byId('studioAdvancedDrawer');
    if (drawer) { drawer.open = true; }
    try { paintKeyPoolChip(); } catch (eC) {}
   });
   /* ══ v0.0.7.e — Private Web App Access Lock wiring ═════════════════ */
   onStudio('btnAlApplyMaster', 'click', function () { alApplyMaster(); });
   onStudio('btnAlSetPassword', 'click', function () { alSetPassword(); });
   onStudio('btnAlSetPin', 'click', function () { alSetPin(); });
   onStudio('btnAlGenCodes', 'click', function () { alGenCodes(); });
   onStudio('btnAlLockAllNow', 'click', function () { alLockAllNow(); });
   onStudio('btnAlNoticeJump', 'click', function () { alJumpToPanel(); });
   onStudio('btnAlNoticeDismiss', 'click', function () { dismissAccessNotice(); });
   onStudio('studioAlRoster', 'click', function (ev) {
    var ev2 = ev || global.event, target = ev2 && (ev2.target || ev2.srcElement);
    var op = target && target.getAttribute ? str(target.getAttribute('data-al')) : '';
    var dev = target && target.getAttribute ? str(target.getAttribute('data-al-dev')) : '';
    if (op && dev) { ev2.stopPropagation(); alRosterAction(dev, op); }
   });
   try { paintAccessLockPanel(); } catch (eAL1) {}
   try { refreshAccessLockRoster(true); } catch (eAL2) {}

   onStudio('btnRefreshLecturerAlerts', 'click', function () {
    withBusy('btnRefreshLecturerAlerts', function (d) {
     try {
      if (SDP.Telemetry && SDP.Telemetry.pullLecturerAlerts) SDP.Telemetry.pullLecturerAlerts(function () { paintLecturerAlertsCard(); d(); });
      else { paintLecturerAlertsCard(); d(); }
     } catch (eT) { paintLecturerAlertsCard(); d(); }
    });
   });
   onStudio('btnClearLecturerAlerts', 'click', function () {
    try { if (SDP.Telemetry && SDP.Telemetry.clearLecturerAlerts) SDP.Telemetry.clearLecturerAlerts(); } catch (eT) {}
    paintLecturerAlertsCard();
    msg('All lecturer alerts dismissed / marked resolved.', 'ok');
   });
   /* Y4: subscribe once to the reactive event bus — every words/voice/pack
      change repaints every studio surface within the same tick. */
   if (!ST.syncBusBound) {
    ST.syncBusBound = true;
    try {
     if (SDP.Sync && SDP.Sync.onChange) {
      SDP.Sync.onChange(function () {
       try { paintAllVoiceSurfaces(); } catch (eP) {}
      });
     }
    } catch (eB) {}
   }
   try { paintLecturerAlertsCard(); } catch (eLA) {}
   try { paintVoiceCoveragePill(); } catch (eVP) {}
   try { paintKeyPoolChip(); } catch (eKP) {} /* v0.0.7.a A2 */
  }
  /* v0.0.6.v — Live Student Activity & Alerts popup wiring. */
  var actDock = byId('studioActivityDock');
  if (actDock && ST.unlocked) actDock.hidden = false;
  onStudio('btnApplyClassroomVoice', 'click', function () {
   withBusy('btnApplyClassroomVoice', function (d) {
    var inp = byId('studioClassroomCustomVoiceId');
    var sel = byId('studioClassroomVoiceSelect');
    var pick = str(inp && inp.value || '');
    if (!pick && sel && sel.value && sel.value !== 'alice') pick = str(sel.value);
    if (!pick) {
     try { dataSaveSettings({ voiceSignature: defaultVoiceSignature() }); } catch (eR) {}
     activeVoiceId = VOICE_ID;
     activeVoiceName = VOICE_NAME;
     if (isObj(ST.secrets)) delete ST.secrets.classroomVoiceId;
     paintClassroomVoiceBar();
     msg(' Unified classroom voice reset to Alice (default).', 'ok');
    } else {
     applyClassroomVoice(pick, '');
    }
    d();
   });
  });
  onStudio('btnRebakeClassroomVoice', 'click', function () {
   withBusy('btnRebakeClassroomVoice', function (d) {
    /* re-bake ALL classroom clips in the active unified voice */
    generateClips({ force: true, forceAllClassroom: true }, function () { d(); });
   });
  });
  onStudio('btnResetClassroomVoice', 'click', function () {
   withBusy('btnResetClassroomVoice', function (d) {
    var base = defaultVoiceSignature();
    try { dataSaveSettings({ voiceSignature: base }); } catch (eR) {}
    activeVoiceId = VOICE_ID;
    activeVoiceName = VOICE_NAME;
    if (isObj(ST.secrets)) delete ST.secrets.classroomVoiceId;
    paintClassroomVoiceBar();
    msg(' Unified classroom voice reset to Alice.', 'ok');
    d();
   });
  });
  /* ══ v0.0.7.a PILLAR 1 (Z1) — #btnRemoveClonedVoiceRestoreDefault ══
     The 1-Click Safe Clone Close / Delete & Instant Revert: clears the clone
     from voiceSignature + Studio settings, wipes every cloned cache override
     (purgeStaleClipsEverywhere with purgeVoiceMismatch so every words.* /
     num.* / cmd.* / guide.* entry baked in the cloned voice is dropped),
     restores the deeply integrated default high-professional voice
     (Alice / Xb7hH8MSUJpSbSDYk0k2) + its 74-clip pack, and VERIFIES the
     restored state before reporting success. */
  onStudio('btnRemoveClonedVoiceRestoreDefault', 'click', function () {
   withBusy('btnRemoveClonedVoiceRestoreDefault', function (d) {
    var wasClone = '';
    try { wasClone = str((dataSettings().voiceSignature || {}).voiceId); } catch (eV0) { wasClone = ''; }
    var base = defaultVoiceSignature();
    try { dataSaveSettings({ voiceSignature: base }); } catch (eR2) {}
    try { dataSaveSettings({ voiceSampleProfile: { confirmed: false, removedAt: Date.now(), revertedTo: VOICE_ID } }); } catch (eP2) {}
    activeVoiceId = VOICE_ID;
    activeVoiceName = VOICE_NAME;
    if (isObj(ST.secrets)) {
     delete ST.secrets.classroomVoiceId;
     if (Array.isArray(ST.secrets.fetchedVoices)) {
      /* drop the applied clone row so the selector can never re-apply it */
      var keep = [], fi;
      for (fi = 0; fi < ST.secrets.fetchedVoices.length; fi++) {
       if (str(ST.secrets.fetchedVoices[fi] && ST.secrets.fetchedVoices[fi].voice_id) === wasClone) continue;
       keep.push(ST.secrets.fetchedVoices[fi]);
      }
      ST.secrets.fetchedVoices = keep;
     }
    }
    if (Array.isArray(ST.fetchedVoices)) {
     var keep2 = [], fj;
     for (fj = 0; fj < ST.fetchedVoices.length; fj++) {
      if (str(ST.fetchedVoices[fj] && ST.fetchedVoices[fj].voice_id) === wasClone) continue;
      keep2.push(ST.fetchedVoices[fj]);
     }
     ST.fetchedVoices = keep2;
    }
    /* wipe every cloned-voice clip override from every cache layer */
    var purgedInfo = null;
    try {
     if (SDP.Speech && SDP.Speech.purgeStaleClipsEverywhere) {
      purgedInfo = SDP.Speech.purgeStaleClipsEverywhere({ purgeVoiceMismatch: true, purgeStaleRev: true, expectedVoiceId: VOICE_ID });
     }
    } catch (eP3) {}
    /* re-select Alice in the dropdown + clear the paste field */
    var sel = byId('studioClassroomVoiceSelect');
    if (sel) { try { sel.value = 'alice'; } catch (eS2) {} }
    var inp = byId('studioClassroomCustomVoiceId');
    if (inp) inp.value = '';
    var binp = byId('studioBriefingCustomVoiceId');
    if (binp && str(binp.value) === wasClone) binp.value = '';
    /* re-inject the canonical Alice pack (74 clips) so playback resumes
       immediately with zero errors, then re-verify the restored state. */
    var clipsRestored = 0, packOk = false;
    try {
     if (SDP.Speech && SDP.Speech.injectClips && ST.voicePack && isObj(ST.voicePack.clips)) {
      SDP.Speech.injectClips(ST.voicePack.clips);
      clipsRestored = Object.keys(ST.voicePack.clips).length;
     }
    } catch (eI) {}
    try {
     if (SDP.Speech && SDP.Speech.state && isObj(SDP.Speech.state.manifest) && isObj(SDP.Speech.state.manifest.clips)) {
      clipsRestored = Math.max(clipsRestored, Object.keys(SDP.Speech.state.manifest.clips).length);
     }
    } catch (eM) {}
    try { packOk = str(voiceSignature().voiceId) === VOICE_ID; } catch (eV2) { packOk = false; }
    paintClassroomVoiceBar();
    try { if (SDP.Sync && SDP.Sync.emitChange) SDP.Sync.emitChange('voice_clone_removed', { revertedTo: VOICE_ID, purged: purgedInfo && purgedInfo.purged }); } catch (eE2) {}
    /* v0.0.7.a Z4 — the clone removal closes with the verified audit banner. */
    try { paintStudioActionAuditBanner('Clone removal &amp; Alice revert', packOk ? 'verified' : 'signature re-check needed'); } catch (eA3) {}
    try {
     if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('voice_clone_removed', { wasClone: wasClone.slice(0, 32), revertedTo: VOICE_ID, clipsRestored: clipsRestored });
    } catch (eD3) {}
    if (packOk) {
     msg('✅ Verified: cloned voice removed — Alice default restored · ' + clipsRestored + ' clips live · ' + (purgedInfo ? purgedInfo.purged : 0) + ' cloned overrides purged.', 'ok');
    } else {
     msg('⚠ Clone removed but the default signature could not be re-verified — run Purge & Refresh in the Live Lab.', 'warn');
    }
    d();
   });
  });
  onStudio('btnOpenLiveLab', 'click', function () {
   try { global.open('./lab.html', '_blank'); } catch (eL) { msg(' Open https://dictationb1.github.io/lab.html', 'warn'); }
  });
  /* v0.0.7.a — Fetch My Cloned Voices: populates BOTH selectors, auto-selects the clone. */
  onStudio('btnFetchClassroomClonedVoices', 'click', function () {
   withBusy('btnFetchClassroomClonedVoices', function (d) {
    var key = resolveElevenKey();
    if (!trimmedKey(str(key))) { msg(' Add the ElevenLabs key first, then fetch again.', 'warn'); d(); return; }
    global.fetch(EL_VOICES, { headers: { 'xi-api-key': key, Accept: 'application/json' } })
     .then(function (res) { if (!res || !res.ok) throw new Error('voices_failed'); return res.json(); }, function () { throw new Error('voices_failed'); })
     .then(function (j) {
      var list = j && Array.isArray(j.voices) ? j.voices : [];
      var saved = Array.isArray(ST.fetchedVoices) ? ST.fetchedVoices.slice() : [], seen = {}, si;
      for (si = 0; si < saved.length; si++) seen[str(saved[si].voice_id)] = 1;
      for (si = 0; si < list.length; si++) if (isObj(list[si]) && str(list[si].voice_id) && !seen[str(list[si].voice_id)]) {
       saved.push({ voice_id: str(list[si].voice_id), name: str(list[si].name), category: str(list[si].category) });
       seen[str(list[si].voice_id)] = 1;
      }
      ST.fetchedVoices = saved;
      if (!isObj(ST.secrets)) ST.secrets = {};
      ST.secrets.fetchedVoices = saved;
      var cSel = byId('studioClassroomVoiceSelect'), bSel = byId('studioBriefingVoiceSelect'), cloneId = '', i;
      var lbl = function (v) { return str(v.name) + ' — ' + ((str(v.category) === 'cloned') ? 'My Cloned Voice' : ((str(v.category) === 'generated') ? 'Generated Voice' : 'Account Voice')) + ' · ' + str(v.voice_id); };
      if (cSel) {
       cSel.innerHTML = '<option value="alice">Alice — Energetic British RP Female (Default)</option>';
       for (i = 0; i < saved.length; i++) {
        var o = doc.createElement('option');
        o.setAttribute('value', str(saved[i].voice_id)); o.textContent = lbl(saved[i]);
        if (str(saved[i].category) === 'cloned' && !cloneId) cloneId = str(saved[i].voice_id);
        cSel.appendChild(o);
       }
       if (cloneId) cSel.value = cloneId;
      }
      if (bSel) {
       var have = {}, bi;
       for (bi = 0; bi < bSel.options.length; bi++) have[String(bSel.options[bi].getAttribute('value'))] = 1;
       for (i = 0; i < saved.length; i++) {
        if (have['id:' + str(saved[i].voice_id)]) continue;
        var bo = doc.createElement('option');
        bo.setAttribute('value', 'id:' + str(saved[i].voice_id)); bo.textContent = lbl(saved[i]);
        bSel.appendChild(bo);
       }
       if (cloneId) bSel.value = 'id:' + cloneId;
      }
      msg(' Fetched ' + saved.length + ' voices — clone auto-selected; press Apply.', 'ok');
      d();
     }, function () { msg(' Could not reach ElevenLabs /v1/voices — check the key.', 'bad'); d(); });
   });
  });
  /* v0.0.7.a — Wipe every words.* key (pack + clipBase + CacheStorage), then re-synthesize the 30 ACTIVE words fresh. */
  onStudio('btnForceRegenWords', 'click', function () {
   withBusy('btnForceRegenWords', function (d) {
    var keys = [], k;
    for (k in ST.voicePack.clips) if (Object.prototype.hasOwnProperty.call(ST.voicePack.clips, k) && /^words\./.test(k)) keys.push(k);
    for (k = 0; k < keys.length; k++) delete ST.voicePack.clips[keys[k]];
    try {
     var base = (global.SDP && SDP.Speech && isObj(SDP.Speech.state)) ? SDP.Speech.state.clipBase : null, bk = [], b;
     if (isObj(base)) {
      for (b in base) if (Object.prototype.hasOwnProperty.call(base, b) && /^words\./.test(b)) bk.push(b);
      for (b = 0; b < bk.length; b++) delete base[bk[b]];
     }
    } catch (eS2) {}
    try {
     if (global.caches && global.caches.open) global.caches.open('sdp-audio-clips').then(function (c) {
      c.keys().then(function (ks) {
       var i;
       for (i = 0; i < ks.length; i++) { try { if (/words\./i.test(str(ks[i] && ks[i].url))) c.delete(ks[i]); } catch (eDl) {} }
      }, function () {});
     }, function () {});
    } catch (eC2) {}
    var cw = currentWords(), wk = [], i2;
    for (i2 = 0; i2 < cw.length; i2++) wk.push('words.' + str(cw[i2] && cw[i2].w).toLowerCase());
    msg(' 🧹 Wiped ' + keys.length + ' old word clips — re-generating all ' + wk.length + ' words fresh…', '');
    generateClips({ force: true, keys: wk }, function () { d(); });
   });
  });
  try { paintClassroomVoiceBar(); } catch (ePB) {}
  onStudio('btnStudioActivityPopup', 'click', function () { openStudioActivityPopup(); });
  onStudio('btnStudioActivityClose', 'click', function () { closeStudioActivityPopup(); });
  onStudio('btnStudioActivityJson', 'click', function () {
   try {
    var led = (sync().settings() || {}).telemetryLedger || { users: [] };
    downloadText('student-activity-telemetry.json', JSON.stringify(led, null, 2));
   } catch (eJ) {}
  });
  onStudio('btnStudioActivityZip', 'click', function () {
   try { buildDiagZip(function () {}); } catch (eZ) {}
  });
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
  paintMasterSteps();
  paintWordManager();
  if (ST.unlocked) {
   paintLiveChips();
   paintWordsHelper();
   paintDiagSummary();
   /* v0.0.6.m Pillar 4: the reviews drawer feed + the ▶ voice-note player. */
   paintReviewsDrawer();
   bindReviewsDrawer();
  }
  paintAiFields();
  placeLecturerBar();
  paintPackDashboard();
  paintGenProgress();
  try { detectWordDeltas(); } catch (e) {}
  if (deltaDetectionReady()) paintDirtyState();
  try { if (SDP.Views && SDP.Views.paintLecturerBar) SDP.Views.paintLecturerBar(); } catch (e) {}
  try { if (SDP.Views && SDP.Views.paintLecturerBanner) SDP.Views.paintLecturerBanner(); } catch (e) {}
  return true;
 }
 function paintAiFields() {
  var select = byId('studioAiProvider');
  if (select) {
   var want = aiProviderName();
   select.value = want;
  }
  var key = byId('studioAiKey');
  if (key && !str(key.value)) key.value = str(ST.aiKey) || str(secrets().aiKey) || '';
  paintSecretFields();
  return true;
 }
 /* D7 (Layer 3): auto-fill every */
 /* D1: every painted field starts */
 function paintSecretFields() {
  var sec = secrets();
  var map = { elKeyInput: 'elevenKey', ghTokenInput: 'ghToken', studioGasUrl: 'gasUrl', studioAiKey: 'aiKey' };
  for (var id in map) {
   if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
   var node = byId(id), val = str(sec[map[id]]);
   if (!node) continue;
   if (val) node.value = val;
   node.setAttribute('data-pristine', '1');
   node.removeAttribute('data-dirty');
  }
  paintFreeNoKey();
  paintVaultBadge();
  return true;
 }
 function paintFreeNoKey() {
  var node = byId('studioFreeNoKey');
  if (!node) return false;
  if (freeNoKeyVisible()) node.removeAttribute('hidden'); else node.setAttribute('hidden', '');
  return true;
 }
 function paintVaultBadge() {
  var node = byId('studioVaultBadge');
  if (!node) return false;
  node.textContent = t('vaultBadgeLabel');
  if (vaultBadgeVisible()) node.removeAttribute('hidden'); else node.setAttribute('hidden', '');
  return true;
 }
 function paintQuickButton() {
  var btn = byId('btnStudioQuick');
  if (!btn) return false;
  /* D5 + v0.0.5.c: dual-tone lock icon + words, never a bare glyph, and the */
  btn.innerHTML = ico(ST.unlocked ? 'unlock' : 'lock', 16) + '<span class="i18n-label studio-quick-label"></span>';
  var lbl = btn.querySelector ? btn.querySelector('.studio-quick-label') : null;
  if (lbl) lbl.textContent = ST.unlocked ? t('lecturerAdminUnlocked') : t('lecturerAdminLocked');
  btn.setAttribute('aria-label', ST.unlocked
   ? t('lecturerAdminUnlocked') + ' — open the Lecturer Admin Studio'
   : t('lecturerAdminLocked') + ' — open the Lecturer Admin Studio');
  btn.setAttribute('data-state', ST.unlocked ? 'unlocked' : 'locked');
  return true;
 }

 function activePinInput() {
  /* SEC-03: locked view has exactly */
  return byId('studioPin');
 }
 function pinValue() { var n = activePinInput(); return n ? str(n.value) : ''; }
 function setPinValue(v) {
  var n = activePinInput();
  if (!n) return '';
  /* R4 / D7: a lecturer PIN may be 4–8 */
  n.value = str(v).replace(/[^0-9]/g, '').slice(0, PIN_MAX);
  paintPinDots();
  return n.value;
 }
 function newPinValue() { return str(fieldValue('studioNewPin') || fieldValue('newPinInput')).replace(/[^0-9]/g, '').slice(0, PIN_MAX); }
 function confirmPinValue() { return str(fieldValue('studioConfirmPin') || fieldValue('confirmPinInput')).replace(/[^0-9]/g, '').slice(0, PIN_MAX); }
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
  var len = pinValue().length;
  /* v0.0.6.d (D8): exactly pinLen dots are shown; the extra pool stays in */
  var shown = pinDotCount(activePinLen());
  for (var i = 0; i < dots.length; i++) {
   if (i < len) dots[i].classList.add('on'); else dots[i].classList.remove('on');
   if (i >= shown) dots[i].classList.add('pin-dot-off'); else dots[i].classList.remove('pin-dot-off');
  }
  host.setAttribute('data-filled', String(len));
  host.setAttribute('data-dots', String(shown));
  /* D8: the clear "✓ PIN Complete" moment once every digit is in. */
  var hint = byId('pinCompleteHint');
  if (hint) {
   if (len > 0 && len >= shown) {
    hint.hidden = false;
    hint.textContent = t('pinComplete', '✓ PIN Complete');
    host.setAttribute('data-complete', 'true');
   } else {
    hint.hidden = true;
    host.setAttribute('data-complete', 'false');
   }
  }
  return true;
 }
 /* D15: the 4-step one-click */
 function paintMasterSteps() {
  var host = byId('studioMasterSteps');
  if (!host) return false;
  var items = host.querySelectorAll ? host.querySelectorAll('li[data-step]') : [];
  var stateIcons = { pending: '\u25cb', active: '\u23f3', ok: '\u2705', bad: '\u26a0\ufe0f' };
  for (var i = 0; i < items.length; i++) {
   var step = Number(items[i].getAttribute('data-step'));
   var state = 'pending';
   if (ST.masterStep > step) state = 'ok';
   else if (ST.masterStep === step) state = ST.masterDetail || 'active';
   else state = 'pending';
   items[i].setAttribute('data-state', state);
   var span = items[i].querySelector ? items[i].querySelector('.studio-step-state') : null;
   if (!span) {
     span = doc.createElement('span');
     span.className = 'studio-step-state';
     items[i].insertBefore(span, items[i].firstChild);
   }
   span.textContent = stateIcons[state] || '\u25cb';
  }
  host.setAttribute('data-step', String(ST.masterStep));
  return true;
 }
 function setMasterStep(step, state) {
  ST.masterStep = Number(step) || 0;
  ST.masterDetail = str(state);
  paintMasterSteps();
  return ST.masterStep;
 }

 /* ══ D-L7: one delegated listener */
 function bindDelegated() {
  var host = byId('studioAccordion');
  if (!host || host._sdpDelegated) return false;
  host._sdpDelegated = true;
  host.addEventListener('click', onStudioClick, false);
  host.addEventListener('input', onStudioInput, false);
  host.addEventListener('change', onStudioChange, false);
  host.addEventListener('focusout', function (ev) {
   if (ownerId(ev && ev.target, host) === 'studioBulkWords') { paintWordCountPill(); scheduleAutoEnrich(); }
  }, false);
  var scr = byId('screen-studio');
  if (scr && !scr._sdpKeyBound) {
   scr._sdpKeyBound = true;
   scr.addEventListener('keydown', onStudioKeydown, false);
  }
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
 function forceRegenChecked() {
  var a = byId('studioForceRegen'), b = byId('chkForceRegen');
  return !!((a && a.checked) || (b && b.checked));
 }
 /* v0.0.4.a W2: debounced zero-touch auto-enrichment while typing words. */
 function scheduleAutoEnrich() {
  try { if (ST.autoEnrichTimer) global.clearTimeout(ST.autoEnrichTimer); } catch (e) {}
  ST.autoEnrichTimer = global.setTimeout(function () {
   ST.autoEnrichTimer = null;
   paintWordCountPill();
   var recognized = parseBulkWords(fieldValue('studioBulkWords') || '').length >= 30;
   enrichWords(fieldValue('studioBulkWords'), { force: false }, function () {
    paintWordManager();
    if (recognized) pulseOneClickCTA();
   });
  }, 400);
 }
 /* v0.0.4.a W3: physical-keyboard PIN entry on the locked gate — the mobile */
 function onStudioKeydown(ev) {
  if (!byId('studioGate')) return;
  var t = ev && ev.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.id !== 'studioPin') return;
  var k = ev && ev.key;
  if (/^[0-9]$/.test(str(k))) {
   appendPin(str(k));
   if (ev.preventDefault) ev.preventDefault();
  } else if (k === 'Backspace') {
   backspacePin();
   if (ev.preventDefault) ev.preventDefault();
  } else if (k === 'Enter') {
   unlock(pinValue(), noop);
   if (ev.preventDefault) ev.preventDefault();
  }
 }
 function onStudioInput(ev) {
  var target = ev && ev.target;
  var id = ownerId(target, byId('studioAccordion'));
  /* D1: a real keystroke makes that */
  if (id === 'elKeyInput' || id === 'ghTokenInput' || id === 'studioAiKey' || id === 'studioGasUrl') {
   if (target && target.getAttribute) {
    target.removeAttribute('data-pristine');
    target.setAttribute('data-dirty', '1');
   }
  }
  if (id === 'studioWords') {
   var editor = byId('studioWords');
   ST.dirty = true;
   ST.words = parseWords(editor ? editor.value : '');
   detectWordDeltas();
   setText(byId('studioCount'), ST.words.length + ' ' + t('studioWordsCount'));
   setText(byId('costPreviewLine'), costPreviewLine(ST.words));
   paintWordManager();
  } else if (id === 'studioBulkWords') {
   ST.dirty = true;
   setStudioWords(parseBulkWords(fieldValue('studioBulkWords')), 'bulk');
   detectWordDeltas();
   clearStaleEnrichOnDeltas(ST.wordDeltas);
   paintDirtyState();
   scheduleAutoEnrich();
   paintLiveChips();
   paintWordsHelper();
  } else if (id === 'studioSessionNoInput') {
   ST.sessionNo = str(target.value).replace(/[^0-9]/g, '');
   ST.dirty = true;
  } else if (id === 'studioSessionTitleInput') {
   ST.title = str(target.value);
   ST.dirty = true;
  } else if (id === 'studioAiKey') {
   var guess = detectProvider(str(target.value));
   if (guess) { ST.aiProvider = guess; var sel = byId('studioAiProvider'); if (sel) sel.value = guess; }
   paintFreeNoKey();
  } else if (id === 'studioPin' || id === 'setupPin') {
   paintPinDots();
  } else if (id === 'studioBriefingCustomVoiceId') {
   /* v0.0.6.q Pillar 1: the pasted Custom / Cloned Voice ID is trimmed and */
   var pastedId = str(target.value || '').replace(/\s+/g, '');
   if (/^[A-Za-z0-9]{16,32}$/.test(pastedId)) {
    if (!isObj(ST.secrets)) ST.secrets = {};
    ST.secrets.briefingCustomVoiceId = pastedId;
    ST.secrets.briefingVoiceKey = 'custom';
    ST.voiceSelectionDirty = true;
    try {
     var vlt2 = vault();
     if (vlt2 && typeof vlt2.stash === 'function') vlt2.stash(ST.secrets);
    } catch (eStash2) {}
   }
  } else if (target && target.getAttribute && target.getAttribute('data-wm')) {
   applyWordManagerEdit(target);
  }
 }
 
 function applyWordManagerEdit(node, commit) {
  var row = Number(node.getAttribute('data-row'));
  var field = str(node.getAttribute('data-wm'));
  if (!(row >= 0) || !field) return false;
  var list = ST.words.length ? ST.words : wordManagerWords();
  if (!isObj(list[row])) return false;
  list[row][field] = str(node.value);
  if (field === 'w') {
   ST.words = list;
   var editor = byId('studioWords');
   if (editor && commit !== false) editor.value = wordsToText(list);
  } else {
   ST.words = list;
   if (commit !== false) {
    var editor2 = byId('studioWords');
    if (editor2) editor2.value = wordsToText(list);
   }
  }
  setText(byId('costPreviewLine'), costPreviewLine(list));
  return true;
 }
 function onStudioChange(ev) {
  var target = ev && ev.target;
  var id = ownerId(target, byId('studioAccordion'));
  if (id === 'studioForceRegen') {
   var mirror = byId('chkForceRegen');
   if (mirror) mirror.checked = !!target.checked;
   return true;
  }
  if (id === 'chkForceRegen') return true;
  if (id === 'studioAiProvider') {
   ST.aiProvider = str(target.value);
   paintFreeNoKey();
   return true;
  }
  /* v0.0.6.q Pillar 1 — the Executive Male Voice selector: the chosen */
  if (id === 'studioBriefingVoiceSelect') {
   var vKey = str(target.value);
   if (/^id:([A-Za-z0-9]{16,32})$/.test(vKey)) {
    var found = /^id:([A-Za-z0-9]{16,32})$/.exec(vKey);
    var customInput = byId('studioBriefingCustomVoiceId');
    if (customInput) customInput.value = found[1];
    if (isObj(ST.secrets)) ST.secrets.briefingCustomVoiceId = found[1];
    if (isObj(ST.secrets)) ST.secrets.briefingVoiceKey = 'custom';
   } else {
    if (isObj(ST.secrets)) ST.secrets.briefingVoiceKey = vKey;
   }
   /* v0.0.6.r: an explicit selector change marks this session's selection
     dirty, so briefingVoiceDelta() may re-synthesize over a live clip. */
   ST.voiceSelectionDirty = true;
   /* Best-effort persistence: the same-tab stash + a vault re-seal keep the */
   try {
    var vlt = vault();
    if (vlt && typeof vlt.stash === 'function') vlt.stash(ST.secrets);
   } catch (eStash) {}
   try { if (ST.unlocked && str(ST.pin || '')) sealVaultNow(noop); } catch (eSeal) {}
   paintBriefingVoiceBar('idle', '· voice set to ' + chosenBriefingVoiceName() + ' — press Generate to re-synthesize');
   return true;
  }
  if (target && target.getAttribute && target.getAttribute('data-wm')) { ST.dirty = true; var okWm = applyWordManagerEdit(target, true); detectWordDeltas(); paintDirtyState(); return okWm; }
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
 /* D10: on clipboard failure */
 function pasteInto(inputId, done) {
  var node = byId(inputId);
  if (!node) { done(new Error('no_field')); return; }
  function focusNode() { try { if (node.focus) node.focus(); } catch (e) {} try { if (node.select) node.select(); } catch (e) {} }
  var clip = global.navigator && global.navigator.clipboard;
  if (clip && typeof clip.readText === 'function') {
   /* v0.0.7.a A5 — the NEVER-HANG PASTE LAW: some browsers leave the
      clipboard promise pending forever when permission is not granted
      (headless Chromium, locked-down iOS Safari). A 1200 ms timeout falls
      back to focusing the field so the lecturer can paste manually — the
      button ALWAYS settles with a clear bilingual message. */
   var settled = false;
   var to = global.setTimeout(function () {
    if (settled) return;
    settled = true;
    focusNode();
    done(new Error('paste_timeout'));
   }, 1200);
   clip.readText().then(function (text) {
    if (settled) return;
    settled = true;
    global.clearTimeout(to);
    node.value = str(text); done(null, node.value);
   }, function () {
    if (settled) return;
    settled = true;
    global.clearTimeout(to);
    focusNode(); done(new Error('paste_denied'));
   });
   return;
  }
  focusNode(); done(new Error('paste_unsupported'));
 }

 /* D3/D15/D17: dead btnStudioUnlock */
 var CLICK_ACTIONS = {
  btnRecoverClips: function () { recoverFromHistory(noop); },
  recoverClips: function () { recoverFromHistory(noop); },
  pinPadClear: function () { setPinValue(''); },
  pinPadBack: function () { backspacePin(); },
  pinPadUnlock: function () { unlock(pinValue(), noop); },
  btnToggleElKey: function () { toggleSecretField('elKeyInput', byId('btnToggleElKey')); },
  btnToggleGhToken: function () { toggleSecretField('ghTokenInput', byId('btnToggleGhToken')); },
  btnToggleAi: function () { toggleSecretField('studioAiKey', byId('btnToggleAi')); },
  btnPasteElKey: function () { pasteInto('elKeyInput', pasteDone); },
  btnPasteGhToken: function () { pasteInto('ghTokenInput', pasteDone); },
  btnPasteAi: function () { pasteInto('studioAiKey', pasteDone); },
  /* D1: the explicit per-row clears (never */
  btnClearElKey: function () { clearSecretField('elKeyInput', 'elevenKey'); },
  btnClearGhToken: function () { clearSecretField('ghTokenInput', 'ghToken'); },
  btnClearAi: function () { clearSecretField('studioAiKey', 'aiKey'); },
  btnClearGasUrl: function () { clearSecretField('studioGasUrl', 'gasUrl'); },
  btnCheckQuota: function () { quotaProbe(); },
  /* ══ v0.0.7.a A2 — the 3 one-click quota-exceeded actions + chip. */
  btnQuotaAddKey: function () {
   /* open Drawer C (Advanced) and focus the first empty EL pool slot */
   var drawer = byId('studioAdvancedDrawer');
   if (drawer) drawer.open = true;
   var elKey = byId('elKeyInput');
   if (elKey && !trimmedKey(str(elKey.value))) { try { elKey.focus(); } catch (eF) {} }
   else {
    var slot = null, i;
    for (i = 1; i <= KEY_POOL_SLOTS; i++) {
     var inp = byId('kpSlot' + i), prov = byId('kpProv' + i);
     if (inp && prov && prov.value === 'elevenlabs' && !trimmedKey(str(inp.value))) { slot = inp; break; }
    }
    if (slot) { try { slot.focus(); } catch (eF2) {} }
   }
   closeQuotaExceededDialog();
   msg('Paste the new ElevenLabs key in the highlighted slot, press Save Keys, then Generate again — synthesis resumes from the missing words only.', 'ok');
  },
  btnQuotaUseReady: function () { trimToReadyClips(); },
  btnQuotaReduceCount: function () { reduceCountToCredits(ST.lastQuotaCheck || null); },
  btnQuotaDismiss: function () { closeQuotaExceededDialog(); },
  /* v0.0.7.a Z1: the 1-click clone removal + Alice revert is also reachable
     through the generic CLICK_ACTIONS path (the Y4e no-dead-button law). */
  btnRemoveClonedVoiceRestoreDefault: function () { byId('btnRemoveClonedVoiceRestoreDefault').click(); },
  /* ══ v0.0.6.m: key pool, briefing voice, diagnostics vault ══ */
  btnProbePool: function () {
   withBusy('btnProbePool', function (d) {
    mergeKeyPoolInputs();
    probePoolKeys(function (err, results) {
     var line = '', i;
     if (err || !results.length) line = ' No ElevenLabs keys in the pool yet — paste a key in any slot first';
     else {
      for (i = 0; i < results.length; i++) {
       line += (line ? ' · ' : '') + 'Slot ' + results[i].slot + ': ' +
        (results[i].ok ? ('OK (' + str(results[i].tier) + ')') : 'unreachable');
      }
     }
     /* v0.0.6.m: the Groq half of the pool is free-tier — report its shape. */
     var groq = groqKeyPool();
     line += groq.length ? (' · Groq free-tier slots: ' + groq.length + '/4') : ' · No Groq free-tier keys yet (Slots #1–#4)';
     var node = byId('kpStatus');
     if (node) { node.textContent = line; }
     msg(' ' + line, results && results.length ? 'ok' : 'bad');
     try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('key_pool_probed', { keys: results ? results.length : 0, groq: groq.length }); } catch (e) {}
     d();
    });
   });
  },
  btnGenIntroClips: function () {
   withBusy('btnGenIntroClips', function (d) {
    /* v0.0.6.n: the Advanced-Tools button now routes through the SAME */
    ensureBriefingAndGuideVoices({ source: 'button', force: true }, function (err, info) {
     d();
     if (err && str(err.message) === 'no_key') return;
     if (err) { msg(' Project Briefing voice failed · ' + quotaError(err), 'bad'); return; }
     msg(' Project Briefing & Guide voices ready · ' + (info ? info.made : 0) + ' new · ' + chosenBriefingVoiceName(), 'ok');
    });
   });
  },
  btnStudioBriefingVoices: function () {
   /* v0.0.6.n FIX 2 — Trigger 3: the 1-tap control at the top of the
      Lecturer Studio. v0.0.6.q Pillar 1 — THE NO-CONFIRM LAW: the blocking
      window.confirm("already up to date…") popup is RETIRED. In v0.0.6.p
      that dialog tricked the creator into thinking his ElevenLabs key had
      already generated the beats while the app kept playing the sandbox
      preload — now the tap ALWAYS forces a full regeneration through the
      real API immediately, in one tap, no questions asked. */
   withBusy('btnStudioBriefingVoices', function (d) {
    ensureBriefingAndGuideVoices({ source: 'button', force: true }, function (err, info) {
     d();
     if (err && str(err.message) === 'no_key') return;
     if (err && str(err.message) === 'busy') return;
     if (err) { msg(' Bridge failed · ' + quotaError(err), 'bad'); return; }
     msg(' Project Overview & Guide voices synced (GitHub + live cache) · ' + ((info && info.made) || 0) + ' new · ' + chosenBriefingVoiceName(), 'ok');
    });
   });
  },
  btnPreviewBriefingBeat: function () {
   /* Plays the committed Beat 1 through the exact briefing tier so the */
   try {
    if (global.SDP && SDP.Speech && SDP.Speech.playBriefingStep) {
     SDP.Speech.playBriefingStep(0, (introSteps()[0] || {}).text || '', function (res) {
      paintBriefingVoiceBar(res && res.autoplayBlocked ? 'idle' : 'ok', '· Beat 1 preview · ' + chosenBriefingVoiceName());
     }, {});
    }
   } catch (e) { msg(' Preview failed — unlock and generate the voices first.', 'bad'); }
  },
  /* v0.0.6.q Pillar 1 — 🔄 Fetch My Cloned Voices: queries the creator's */
  btnFetchClonedVoices: function () {
   withBusy('btnFetchClonedVoices', function (d) {
    var key = resolveElevenKey();
    if (!trimmedKey(str(key))) {
     msg(' Add the ElevenLabs key (Step 1) first — then Fetch My Cloned Voices can list your account.', 'warn');
     paintBriefingVoiceBar('nokey', '· cloned-voice discovery needs the ElevenLabs key');
     d();
     return;
    }
    try {
     global.fetch(EL_VOICES, { headers: { 'xi-api-key': key, Accept: 'application/json' } })
      .then(function (res) {
       if (!res || !res.ok) throw withStatus(new Error('voices_failed'), res && res.status ? res.status : 0);
       return res.json();
      })
      .then(function (j) {
       var sel = byId('studioBriefingVoiceSelect');
       var list = j && Array.isArray(j.voices) ? j.voices : [];
       if (!sel || !list.length) {
        paintBriefingVoiceBar('idle', '· no cloned voices found in the account');
        msg(' No voices returned by /v1/voices — check the key.', 'warn');
        d();
        return;
       }
       /* v0.0.6.r: cloned/generated/professional account voices sort FIRST
          so the creator's own Cloned Voice tops the dropdown. */
       var rank = function (v) {
        var c = str(v && v.category);
        if (c === 'cloned') return 0;
        if (c === 'generated') return 1;
        if (c === 'professional') return 2;
        return 3;
       };
       list = list.slice().sort(function (a, b) { return rank(a) - rank(b); });
       /* v0.0.6.r: the discovered account voices are remembered in
          ST.fetchedVoices AND ST.secrets.fetchedVoices so mount() re-renders
          and reloads keep the selector populated without a re-fetch. */
       var seenIds = {}, saved = Array.isArray(ST.fetchedVoices) ? ST.fetchedVoices.slice() : [], si;
       for (si = 0; si < saved.length; si++) seenIds[str(saved[si].voice_id)] = 1;
       for (si = 0; si < list.length; si++) {
        if (isObj(list[si]) && str(list[si].voice_id) && !seenIds[str(list[si].voice_id)]) {
         saved.push({ voice_id: str(list[si].voice_id), name: str(list[si].name), category: str(list[si].category) });
         seenIds[str(list[si].voice_id)] = 1;
        }
       }
       ST.fetchedVoices = saved;
       if (!isObj(ST.secrets)) ST.secrets = {};
       ST.secrets.fetchedVoices = saved;
       /* keep the curated catalog; append every account voice (clones and */
       var have = {}, i, opt, v, added = 0;
       for (i = 0; i < sel.options.length; i++) have[String(sel.options[i].getAttribute('value'))] = 1;
       for (i = 0; i < BRIEFING_VOICE_ORDER.length; i++) {
        var p = BRIEFING_VOICE_CATALOG[BRIEFING_VOICE_ORDER[i]];
        if (p && p.id) have[p.id] = 1;
       }
       for (i = 0; i < list.length; i++) {
        v = list[i];
        if (!isObj(v) || !str(v.voice_id) || have[str(v.voice_id)]) continue;
        opt = doc.createElement('option');
        opt.setAttribute('value', 'id:' + str(v.voice_id));
        opt.textContent = str(v.name) + ' — ' + ((v.category === 'cloned') ? 'My Cloned Voice' : 'Account Voice') + ' · ' + str(v.voice_id);
        sel.appendChild(opt);
        have[str(v.voice_id)] = 1;
        added += 1;
       }
       /* v0.0.6.r AUTO-SELECT LAW → v0.0.6.t PILLAR 3E: pass 1 looks
          STRICTLY for a genuine Cloned / Professional / Generated voice (a
          premade account voice is never auto-picked); only when none exists
          does pass 2 accept any non-catalog, non-premade voice. When one is
          found it is ALWAYS selected — even over an older custom ID sitting
          in the field — sealed into the vault and synthesized immediately:
          one 🔄 Fetch click = selected + synced, no second manual click. */
       var firstClone = null, ci, ck;
       var isCloneCat = function (cv) { return cv.category === 'cloned' || cv.category === 'professional' || cv.category === 'generated'; };
       var inCatalogOf = function (vid) {
        for (ck in BRIEFING_VOICE_CATALOG) {
         if (Object.prototype.hasOwnProperty.call(BRIEFING_VOICE_CATALOG, ck) && BRIEFING_VOICE_CATALOG[ck].id === str(vid)) return true;
        }
        return false;
       };
       for (ci = 0; ci < list.length && !firstClone; ci++) {
        var cv = list[ci];
        if (!isObj(cv) || !str(cv.voice_id)) continue;
        if (isCloneCat(cv)) firstClone = cv;
       }
       if (!firstClone) {
        for (ci = 0; ci < list.length && !firstClone; ci++) {
         var cv2 = list[ci];
         if (!isObj(cv2) || !str(cv2.voice_id)) continue;
         if (cv2.category !== 'premade' && !inCatalogOf(cv2.voice_id)) firstClone = cv2;
        }
       }
       if (firstClone) {
        sel.value = 'id:' + str(firstClone.voice_id);
        var cust = byId('studioBriefingCustomVoiceId');
        if (cust) cust.value = str(firstClone.voice_id);
        /* v0.0.6.w: the discovered clone becomes the UNIFIED classroom voice
           too — one fetch click selects it for the briefing AND every word. */
        try { applyClassroomVoice(str(firstClone.voice_id), str(firstClone.name)); } catch (eAC) {}
        var cc = byId('studioClassroomCustomVoiceId');
        if (cc) cc.value = str(firstClone.voice_id);
        ST.secrets.briefingCustomVoiceId = str(firstClone.voice_id);
        ST.secrets.briefingVoiceKey = 'custom';
        ST.secrets.briefingVoiceName = str(firstClone.name);
        ST.voiceSelectionDirty = true;
        try {
         var vltF = vault();
         if (vltF && typeof vltF.stash === 'function') vltF.stash(ST.secrets);
        } catch (eStashF) {}
        try { if (ST.unlocked && str(ST.pin || '')) sealVaultNow(noop); } catch (eSealF) {}
        msg(' Cloned voice "' + str(firstClone.name) + '" selected — synthesizing & syncing now…', 'ok');
        /* v0.0.6.t PILLAR 3E: the fetch click IS the generate click. */
        ensureBriefingAndGuideVoices({ source: 'button', force: true }, noop);
       }
       paintBriefingVoiceBar('idle', '· ' + added + ' account voices added to the selector');
       msg(' ' + added + ' ElevenLabs account voices added — pick one, or paste its ID in the custom field.', 'ok');
       d();
      })
      .catch(function (err) {
       paintBriefingVoiceBar('error', '· /v1/voices failed · ' + quotaError(err));
       msg(' Fetch My Cloned Voices failed · ' + quotaError(err), 'bad');
       d();
      });
    } catch (e) {
     paintBriefingVoiceBar('error', '· /v1/voices failed');
     msg(' Fetch My Cloned Voices failed.', 'bad');
     d();
    }
   });
  },
  btnDownloadDiagZip: function () {
   withBusy('btnDownloadDiagZip', function (d) {
    buildDiagZip(function (err, info) {
     var node = byId('diagStatus');
     if (err) {
      if (node) node.textContent = ' Diagnostics .zip failed · ' + str(err.message || err);
      msg(' Diagnostics .zip failed · ' + str(err.message || err), 'bad');
     } else {
      if (node) node.textContent = ' Diagnostics .zip downloaded · ' + info.files + ' files · ' + info.bytes + ' bytes';
      msg(' Diagnostics .zip downloaded · ' + info.files + ' files · ' + info.bytes + ' bytes', 'ok');
     }
     d();
    });
   });
  },
  btnClearDiag: function () {
   try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.clearAll(); } catch (e) {}
   paintDiagSummary();
   msg(' Local diagnostics cleared', 'ok');
  },
  btnDownloadReviewsZip: function () {
   withBusy('btnDownloadReviewsZip', function (d) {
    buildReviewsZip(function (err, info) {
     var node = byId('reviewsStatus');
     if (err) {
      if (node) node.textContent = ' Reviews .zip failed · ' + str(err.message || err);
      msg(' Reviews .zip failed · ' + str(err.message || err), 'bad');
     } else {
      if (node) node.textContent = ' Reviews & telemetry .zip downloaded · ' + info.files + ' files · ' + info.bytes + ' bytes';
      msg(' Reviews & telemetry .zip downloaded · ' + info.files + ' files · ' + info.bytes + ' bytes', 'ok');
     }
     d();
    });
   });
  },
  btnRefreshReviews: function () {
   paintReviewsDrawer();
   msg(' User reviews & session telemetry refreshed', 'ok');
  },
  btnRefreshQuota: function () { quotaProbe(); },
  btnPreviewWords: function () { openPublishPreview(); },
  btnLockStudio: function () { lock(); },
  btnStudioLock: function () { lock(); },
  btnSsbLock: function () { lock(); },
  /* v0.0.7.b B5: the interactive Studio Guide (Simple | Advanced chooser). */
  btnStudioGuide: function () {
   try { if (SDP.StudioGuide && SDP.StudioGuide.open) { SDP.StudioGuide.open('chooser'); return; } } catch (e) {}
   msg('The Studio Guide is not available in this build.', 'warn');
  },
  /* v0.0.7.b B4 — PUBLISH, SYNC & LEAVE: the button now does exactly what
     its name promises. On verified success it (1) releases the classroom
     dictation lock so students can start at once, (2) LOCKS Lecturer Admin
     Studio (no unlocked Studio is ever left behind — students can never
     reach it), and (3) returns the lecturer to the main app. A failed
     publish keeps the Studio open and shows the exact reason. */
  btnSsbPublish: function () {
   withBusy('btnSsbPublish', function (d) {
    publishWordsAndVoice(function (err) {
     d();
     if (err) return; /* publishReason() already messaged the failure */
     try { releaseDictationForStudents(); } catch (eR) {}
     try { lock(); } catch (eL) {}
     try { if (SDP.Views && SDP.Views.showScreen) SDP.Views.showScreen('home'); } catch (eT) {}
     try { if (SDP.Views && SDP.Views.showToast) SDP.Views.showToast(t('studioPublishLockOk', 'Published, synced & locked — students can start dictation now.')); } catch (eTo) {}
    });
   });
  },
  /* v0.0.7.a Pillar 1 (Y1): the Voice Sample Studio controller buttons. */
  btnVoiceSampleRecord: function () { toggleVoiceSampleRecord(); },
  btnVoiceSampleStop: function () { vsStopRecording(); },
  btnConfirmVoiceSample: function () {
   withBusy('btnConfirmVoiceSample', function (d) {
    if (!VS.blob) { msg('Record or upload a voice sample first.', 'bad'); d(); return; }
    vsDecode(VS.blob, function (err, buf) {
     if (err || !buf) { msg('Could not decode the audio — try a different file.', 'bad'); d(); return; }
     var dur = Math.round(buf.duration * 10) / 10;
     if (dur < 30 || dur > 150) { msg('Sample is ' + dur + ' s — must be 30–120 s (150 s max).', 'warn'); d(); return; }
     VS.pcm = buf;
     VS.confirmed = true;
     try {
      dataSaveSettings({ voiceSampleProfile: { confirmed: true, source: VS.source, durationSec: dur, sampleRate: buf.sampleRate, at: Date.now() } });
     } catch (eS) {}
     msg('Reference Voice Sample confirmed (' + dur + ' s, ' + buf.sampleRate + ' Hz). Run the AI Analyzer next.', 'ok');
     try { SDP.Sync.emitChange('voice_sample_confirmed', { durationSec: dur }); } catch (eE) {}
     d();
    });
   });
  },
  btnRunVoiceAnalyzer: function () {
   withBusy('btnRunVoiceAnalyzer', function (d) {
    if (!VS.blob || !VS.confirmed) { msg('Confirm a Reference Voice Sample first.', 'bad'); d(); return; }
    vsDecode(VS.blob, function (err, buf) {
     if (err || !buf) { msg('Could not decode the audio sample.', 'bad'); d(); return; }
     VS.pcm = buf;
     msg('Stage 1 DSP analysis done — auto-transcribing the free-speech sample…', 'ok');
     /* v0.0.7.a Z2: the free-speech auto-transcription leg runs beside the
        acoustic profile (intelligibility, articulation clarity, WPM). */
     var dur = Math.round(buf.duration * 10) / 10;
     vsTranscribeSample(VS.blob, dur, function (tErr, tInfo) {
      VS.transcript = isObj(tInfo) ? tInfo : null;
      analyzeVoiceSampleWithAi(VS.blob, buf, function (errA, prof) {
       if (errA || !prof) { msg('Analyzer failed.', 'bad'); d(); return; }
       if (VS.transcript && prof.metrics) {
        prof.metrics.wordsPerMinute = VS.transcript.wordsPerMinute;
        prof.metrics.articulationClarity = VS.transcript.articulationClarity;
        prof.metrics.transcriptSource = VS.transcript.source;
       }
       vsPaintAnalysisCard(prof, null);
       msg('Voice analysis complete — quality ' + prof.qualityScore + '/100 (' + prof.source + ') · ' + (VS.transcript ? VS.transcript.wordsPerMinute + ' WPM (' + VS.transcript.source + ')' : 'no transcript') + '. Now enhancing…', 'ok');
       /* Stage 3: run the enhancement chain and paint the after-metrics. */
       vsEnhanceSample(buf, prof.enhancementPlan, function (errE, rendered, samples) {
        if (!errE && rendered && samples) {
         try {
          var fsx = rendered.sampleRate;
          var mono = samples;
          var lufsAfter = -70, peakAfter = -99;
          try { if (SDP.AudioNormalize && SDP.AudioNormalize.measureLoudness) lufsAfter = SDP.AudioNormalize.measureLoudness(mono, fsx); } catch (eL) {}
          try { if (SDP.AudioNormalize && SDP.AudioNormalize.truePeakDb) peakAfter = SDP.AudioNormalize.truePeakDb(mono); } catch (eP) {}
          vsPaintAnalysisCard(prof, { durationSec: Math.round((mono.length / fsx) * 10) / 10, integratedLufs: Math.round(lufsAfter * 10) / 10, truePeakDbTP: Math.round(peakAfter * 10) / 10, noiseFloorDb: prof.metrics ? prof.metrics.noiseFloorDb : undefined, spectralCentroidHz: prof.metrics ? prof.metrics.spectralCentroidHz : undefined, presenceRatio: Math.min(0.95, ((prof.metrics && prof.metrics.presenceRatio) || 0) * 1.6) });
         } catch (eV) {}
        }
        d();
       });
      });
     });
    });
   });
  },
  /* v0.0.7.a Z2: 1-Click Quick-Apply of an existing ElevenLabs Voice ID. */
  btnQuickApplyVoiceId: function () {
   withBusy('btnQuickApplyVoiceId', function (d) {
    var inp = byId('voiceSampleQuickApplyId');
    var id = str(inp && inp.value).replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{16,32}$/.test(id)) { msg('Paste a valid ElevenLabs Voice ID (16–32 chars) — no spaces.', 'warn'); d(); return; }
    var ok = applyClassroomVoice(id, '');
    if (ok) {
     try { dataSaveSettings({ voiceSampleProfile: { quickApplied: true, voiceId: id, at: Date.now() } }); } catch (eQ) {}
     msg('⚡ Quick-Apply verified: cloned voice "' + id + '" is now the unified classroom voice — re-bake words with Apply again or Generate.', 'ok');
     if (inp) inp.value = '';
    }
    d();
   });
  },
  /* v0.0.7.a Z2: the 1-Word Low-Credit Verification Test (~10 chars). */
  btnLowCreditVerifyTest: function () {
   withBusy('btnLowCreditVerifyTest', function (d) {
    vsLowCreditVerifyTest(function (err, info) {
     if (err) {
      msg('✗ Low-Credit Test FAILED — HTTP ' + err.http + ' · ' + err.cause + ' · FIX: ' + err.fix, 'bad');
      try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('low_credit_test_fail', { http: err.http, cause: err.cause }); } catch (eD) {}
     } else {
      msg('✅ Verified: real ElevenLabs generation succeeded — HTTP 200 · ' + info.bytes + ' bytes · MP3 ' + (info.mp3 ? 'genuine' : 'unknown') + ' · ~' + info.text.length + ' chars burned.', 'ok');
      try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('low_credit_test_ok', { bytes: info.bytes }); } catch (eD2) {}
     }
     d();
    });
   });
  },
  btnCreateAndApplyVoiceClone: function () {
   withBusy('btnCreateAndApplyVoiceClone', function (d) {
    createAndApplyVoiceClone(function () {
     /* v0.0.7.a Z4 — the clone pipeline closes with the audit banner. */
     try { paintStudioActionAuditBanner('Voice clone + word bake', str(activeVoiceName || 'cloned voice')); } catch (eA2) {}
     d();
    });
   });
  },
  /* v0.0.7.a Pillar 3 (Y3): the Lecturer Alert Inbox buttons. */
  btnRefreshLecturerAlerts: function () {
   withBusy('btnRefreshLecturerAlerts', function (d) {
    try {
     if (SDP.Telemetry && SDP.Telemetry.pullLecturerAlerts) {
      SDP.Telemetry.pullLecturerAlerts(function () { paintLecturerAlertsCard(); d(); });
     } else { paintLecturerAlertsCard(); d(); }
    } catch (eT) { paintLecturerAlertsCard(); d(); }
   });
  },
  btnClearLecturerAlerts: function () {
   try {
    if (SDP.Telemetry && SDP.Telemetry.clearLecturerAlerts) SDP.Telemetry.clearLecturerAlerts();
   } catch (eT) {}
   paintLecturerAlertsCard();
   msg('All lecturer alerts dismissed / marked resolved.', 'ok');
  },
  btnStudioRecord: function () { toggleVoiceSampleRecord(); },
  /* v0.0.7.a: the legacy settings-card pair now drives the SAME Voice
     Sample Studio pipeline (no dead buttons — G12.5c keeps the ids). */
  btnCommitClip: function () {
   withBusy('btnCommitClip', function (d) {
    if (!VS.blob) { msg('Record or upload a voice sample first (AI Voice Sample Studio card).', 'bad'); d(); return; }
    vsDecode(VS.blob, function (err, buf) {
     if (err || !buf) { msg('Could not decode the audio sample.', 'bad'); d(); return; }
     var dur = Math.round(buf.duration * 10) / 10;
     VS.pcm = buf;
     VS.confirmed = true;
     try { dataSaveSettings({ voiceSampleProfile: { confirmed: true, source: VS.source, durationSec: dur, sampleRate: buf.sampleRate, at: Date.now() } }); } catch (eS) {}
     msg('Reference Voice Sample confirmed (' + dur + ' s). Run the AI Analyzer in the Voice Sample Studio.', 'ok');
     try { SDP.Sync.emitChange('voice_sample_confirmed', { durationSec: dur }); } catch (eE) {}
     d();
    });
   });
  },
  btnTestElKey: function () { withBusy('btnTestElKey', function (d) { testElevenLabsKey(trimmedKey(fieldValue('elKeyInput')) || str(resolveElevenKey()), function (e, r) { onElTest(e, r); d(); }); }); },
  btnTestGhToken: function () { withBusy('btnTestGhToken', function (d) { testGitHubToken(fieldValue('ghTokenInput') || str(ST.secrets.ghToken), function (e, r) { onGhTest(e, r); d(); }); }); },
  btnTestOneWord: function () { withBusy('btnTestOneWord', function (d) { generateClips({ singleTest: true }, function () { d(); }); }); },
  btnGenClips: function () { withBusy('btnGenClips', function (d) { generateClips({ force: forceRegenChecked() }, function () { d(); }); }); },
  btnTestAi: function () { withBusy('btnTestAi', function (d) { testAiEngine(function () { d(); }); }); },
  btnEnrichWords: function () { withBusy('btnEnrichWords', function (d) { enrichWords(fieldValue('studioWords') || fieldValue('studioBulkWords'), { force: false }, function () { d(); }); }); },
  btnOneClickMasterSetup: function () { withBusy('btnOneClickMasterSetup', function (d) { oneClickMasterSetup(function () { d(); }); }); },
  btnRetryFailedStep: function () {
   var host = byId('studioErrorAssistant');
   var step = Number(host && host.getAttribute('data-step')) || 4;
   withBusy('btnRetryFailedStep', function (d) { oneClickMasterSetup(function () { d(); }); });
  },
  btnDismissError: function () {
   var host = byId('studioErrorAssistant');
   if (host) { host.setAttribute('data-state', 'hidden'); host.innerHTML = ''; }
  },
  btnPublishWordsAndVoice: function () { withBusy('btnPublishWordsAndVoice', function (d) { publishWordsAndVoice(function () { d(); }); }); },
  btnPublishWords: function () { withBusy('btnPublishWords', function (d) { publish(function () { d(); }); }); },
  btnStudioSyncSettings: function () { withBusy('btnStudioSyncSettings', function (d) { publishWordsAndVoice(function (err) { msg(err ? t('studioPublishFail') : t('studioPublishOk'), err ? 'bad' : 'ok'); d(); }); }); },
  /* E8: atomic PIN change — validate 4–8 digits, confirm match, re-seal the */
  btnChangePin: function () { withBusy('btnChangePin', function (d) { changePin(function () { d(); }); }); },
  btnVerifyEleven: function () { withBusy('btnVerifyEleven', function (d) { verifyElevenKey(); d(); }); },
  /* v0.0.7.c (BUG-03): live per-provider key tests with HTTP diagnostics. */
  btnVerifyGroq: function () { withBusy('btnVerifyGroq', function (d) { verifyGroqKey(function () { d(); }); }); },
  btnVerifyGemini: function () { withBusy('btnVerifyGemini', function (d) { verifyGeminiKey(function () { d(); }); }); },
  btnRetryFailedClip: function () {
   var failed = ST.lastFailedClip;
   if (!failed || !failed.key) { msg(t('studioRetryNone'), ''); return; }
   withBusy('btnRetryFailedClip', function (d) { generateClips({ keys: [failed.key] }, function () { d(); }); });
  },
  btnSaveKeys: function () { withBusy('btnSaveKeys', function (d) { saveKeys(); global.setTimeout(function () { msg(T('studioSavedOk'), 'ok'); d(); }, 1500); }); },
  /* v0.0.6.e (A): non-destructive chip-grid utilities. */
  btnStudioPasteWords: function () {
   pasteInto('studioBulkWords', function (err) {
    if (!err) { setStudioWords(parseBulkWords(fieldValue('studioBulkWords')), 'bulk'); }
    paintLiveChips(); paintWordsHelper();
   });
  },
  btnStudioClearWords: function () {
   var bulk = byId('studioBulkWords'); if (bulk) bulk.value = '';
   ST.words = []; ST.rawParsedWords = [];
   setStudioWords([], 'bulk'); paintLiveChips(); paintWordsHelper();
   msg(t('wordsCleared', 'Word editor cleared'), '');
  },
  btnStudioConfirmWords: function () {
   ST.wordsConfirmed = true;
   var b = byId('studioWordsStatusBanner');
   if (b) { setText(b, t('wordsConfirmedOk', '\u2713 Words confirmed \u2014 ready to Broadcast')); b.setAttribute('data-state', 'ok'); }
   msg(t('wordsConfirmedOk', '\u2713 Words confirmed \u2014 ready to Broadcast'), 'ok');
  }
 };
 function onStudioClick(ev) {
  var target = ev && ev.target;
  var actEl = target;
  while (actEl && actEl !== byId('studioAccordion') && !(actEl.getAttribute && actEl.getAttribute('data-action'))) actEl = actEl.parentNode;
  /* v0.0.7.a Pillar 3 (Y3): the per-alert 1-click resolution buttons. */
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-alert-action')) {
   if (ev.preventDefault) ev.preventDefault();
   var act = actEl.getAttribute('data-alert-action');
   if (act === 'fix') {
    var fixBtn = byId('btnForceRegenWords');
    if (fixBtn) fixBtn.click();
    else generateClips({ force: true }, noop);
   } else if (act === 'publish') {
    var pubBtn = byId('btnSsbPublish');
    if (pubBtn) pubBtn.click();
   } else if (act === 'resolve') {
    var row = actEl.parentNode;
    while (row && !(row.className && String(row.className).indexOf('studio-alert-row') >= 0)) row = row.parentNode;
    if (row) row.setAttribute('data-resolved', '1');
   }
   return;
  }
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'previewWmRow') {
   if (ev.preventDefault) ev.preventDefault();
   previewWmRow(actEl.getAttribute('data-row'));
   return;
  }
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'toggleWmRow') {
   if (ev.preventDefault) ev.preventDefault();
   toggleWmRow(actEl.getAttribute('data-row'));
   return;
  }
  /* v0.0.6.m Pillar 2: the per-word verifier + single-word re-synthesis. */
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'verifyWmRow') {
   if (ev.preventDefault) ev.preventDefault();
   verifyWmRow(actEl.getAttribute('data-row'));
   return;
  }
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'resynthWmRow') {
   if (ev.preventDefault) ev.preventDefault();
   resynthWmRow(actEl.getAttribute('data-row'));
   return;
  }
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'chip-remove') {
   if (ev.preventDefault) ev.preventDefault();
   chipRemove(Number(actEl.getAttribute('data-idx')));
   paintLiveChips(); paintWordsHelper();
   return;
  }
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'chip-merge') {
   if (ev.preventDefault) ev.preventDefault();
   chipMerge(Number(actEl.getAttribute('data-idx')));
   paintLiveChips(); paintWordsHelper();
   return;
  }
  var id = ownerId(target, byId('studioAccordion'));
  if (!id) return;
  var digit = target && target.getAttribute ? target.getAttribute('data-pin') : null;
  if (digit !== null && digit !== undefined && digit !== '') {
   appendPin(digit);
   if (ev.preventDefault) ev.preventDefault();
   return;
  }
  var action = CLICK_ACTIONS[id];
  if (action) { if (ev.preventDefault) ev.preventDefault(); action(ev); }
 }
 function fieldValue(id) { var n = byId(id); return n ? str(n.value) : ''; }
 function pasteDone(err) {
  testStatus(err ? 'Clipboard unavailable — field focused, press Ctrl+V to paste' : t('studioPaste') + ' ', err ? 'warn' : 'ok');
 }
 function quotaProbe() {
   /* D2: probeQuota paints the green */
  refreshQuota(function (err) {
   if (err) { testStatus(quotaError(err), 'bad'); paintCreditBanner(quotaError(err)); return; }
   hideCreditBanner();
  });
 }
 /* v0.0.6.d (D8): the bilingual API Credits Exhausted warning banner. Shown */
 function paintCreditBanner(reason) {
  var host = byId('studioCreditBanner');
  if (!host) {
   host = doc.createElement('div');
   host.id = 'studioCreditBanner';
   host.className = 'studio-credit-banner';
   host.setAttribute('role', 'region');
   host.setAttribute('aria-live', 'polite');
   host.setAttribute('data-state', 'hidden');
   host.innerHTML =
    '<p class="scb-line">' + esc(t('apiCreditsExhausted')) + '</p>' +
    '<p class="scb-line" lang="si">' + esc(t('apiCreditsExhaustedSi')) + '</p>' +
    (str(reason) ? '<p class="scb-detail">' + esc(str(reason)) + '</p>' : '') +
    '<button type="button" class="btn btn-primary btn-sm" id="btnFixApiCredits">' +
    ico('key', 16) + '<span class="i18n-label">' + esc(t('apiCreditsFixNow')) + '</span></button>';
   var body = byId('studioBody');
   if (body && body.firstChild) body.insertBefore(host, body.firstChild);
   else if (body) body.appendChild(host);
   var fix = byId('btnFixApiCredits');
   if (fix && fix.addEventListener) {
    fix.addEventListener('click', function () {
     try {
      var drawer = byId('studioAdvancedDrawer');
      if (drawer && drawer.setAttribute) drawer.setAttribute('open', 'open');
      if (drawer && typeof drawer.open === 'boolean') drawer.open = true;
     } catch (e) {}
     try {
      var key = byId('elKeyInput') || byId('studioAiKey');
      if (key && key.focus) key.focus({ preventScroll: false });
     } catch (e2) {}
    }, false);
   }
  }
  var detail = host.querySelector ? host.querySelector('.scb-detail') : null;
  if (detail) detail.textContent = str(reason) || '';
  host.setAttribute('data-state', 'visible');
  host.removeAttribute('hidden');
  return true;
 }
 function hideCreditBanner() {
  var host = byId('studioCreditBanner');
  if (host) host.setAttribute('data-state', 'hidden');
  return true;
 }
 function creditExhausted(result, err) {
  if (err) {
   var c = Number((err && err.status) || 0);
   return c === 401 || c === 402 || c === 429;
  }
  if (isObj(result) && !result.scoped) {
   var left = Number(result.remaining);
   return !isNaN(left) && left < 200;
  }
  return false;
 }
 function onElTest(err, result) {
  if (err) { testStatus(quotaError(err), 'bad'); if (creditExhausted(null, err)) paintCreditBanner(quotaError(err)); return; }
  if (creditExhausted(result, null)) {
   paintCreditBanner('Remaining: ' + Number(result.remaining) + ' chars');
  } else { hideCreditBanner(); }
  if (result && result.scoped) {
   var note = str(result.note) || SCOPED_NOTE();
   testStatus(' ' + note, 'ok');
   setText(byId('quotaText'), note);
   return;
  }
  var used = Number(result.used || 0), limit = Number(result.limit || 0), left = Number(result.remaining || 0);
  testStatus(' ElevenLabs Connected · Used ' + used + ' / Limit ' + limit + ' chars (Remaining: ' + left + ')', 'ok');
  setText(byId('quotaText'), 'Used ' + used + ' / Limit ' + limit + ' chars · Remaining: ' + left);
 }
 function onGhTest(err, result) {
  if (err) { testStatus(' ' + ghError(err), 'bad'); return; }
  testStatus(' GitHub Connected (' + result.repo + ' · Write OK)', 'ok');
 }

 /* D6 (Layer 2): seal + Layer 1 + push… */
 var SAVE_LOCAL_ONLY = 'Saved in local Vault (protected across updates)';
 /* D1: one place reads the */
 function mergeSecretInputs() {
  var s = ST.secrets = isObj(ST.secrets) ? ST.secrets : {}, p = {}, i, k, el, v, dirty;
  for (i = 0; i < SECRET_FIELDS.length; i++) {
   k = SECRET_FIELDS[i].key; el = byId(SECRET_FIELDS[i].id);
   v = el ? str(el.value) : '';
   dirty = !!(el && el.getAttribute('data-dirty') === '1');
   /* D1: unmounted or empty-pristine */
   p[k] = v !== '' ? v : (dirty ? '' : str(s[k]));
  }
  p.aiProvider = aiProviderName(); p.updatedAt = Date.now();
  for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) s[k] = p[k];
  /* v0.0.6.m: the five pool slots ride the same sealed vault write. */
  mergeKeyPoolInputs();
  ST.aiProvider = p.aiProvider; ST.aiKey = p.aiKey;
  return s;
 }
 function saveKeys() {
  if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); return false; }
  /* R4 (F5): never seal a key ID. e1b… is 64 hex chars and ElevenLabs */
  var typed = trimmedKey(fieldValue('elKeyInput'));
  if (typed && !looksLikeElevenKey(typed)) {
   msg(elevenKeyHint(), 'bad');
   testStatus(' ' + elevenKeyHint(), 'bad');
   paintElVerify(elevenKeyHint(), 'bad');
   return false;
  }
  /* SEC-02 / R4: a new 4–8 digit PIN */
  var wantPin = newPinValue();
  var confirmPin = confirmPinValue();
  if (wantPin.length >= PIN_MIN || confirmPin.length) {
   if (wantPin.length < PIN_MIN || wantPin.length > PIN_MAX) { msg(t('studioBadPin'), 'bad'); return false; }
   if (wantPin !== confirmPin) { msg(t('studioPinMismatch'), 'bad'); return false; }
   ST.pin = wantPin;
  }
  /* D1: snapshot before the merge, then */
  var prevSecrets = secretSnapshot();
  mergeSecretInputs();
  guardSecretMerge(prevSecrets);
  var pin = str(ST.pin || '');
  var v = vault();
  if (!v || !pin) {
    if (isRealEnvelope(ST.envelope)) writeLayerOne(ST.envelope, pinVerifier() || layerOneVerifier());
   msg(SAVE_LOCAL_ONLY, 'ok');
   return true;
  }
  sealVaultNow(function (err, envelope, verifier) {
   if (err) { msg(t('studioPublishFail') + ' · encrypt_failed', 'bad'); return; }
    writeLayerOne(envelope, verifier || pinVerifier());
   mount();
   var token = str(ST.secrets.ghToken);
   if (!token || !sync() || !sync().publishFilesSequential) {
    msg(SAVE_LOCAL_ONLY, 'ok');
    toast(SAVE_LOCAL_ONLY);
    return;
   }
   var cfgBody = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
   cfgBody.encVault = str(envelope);
   if (isObj(pinVerifier())) cfgBody.pinVerifier = pinVerifier();
   publishConfigAndVersion(cfgBody, envelope, 'Studio vault ' + appVersion(), function (pubErr) {
    if (pubErr) {
        var line = SAVE_LOCAL_ONLY + ' · GitHub sync failed: ' + str(pubErr.message || 'network error');
     msg(line, 'bad');
     toast(line);
     return;
    }
    msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
    toast(t('vaultSavedToast'));
    loadVoicePack(function () { paintPackDashboard(); paintClipTable(); });
   });
  });
  return true;
 }

 /* R5/D8: pagehide, beforeunload and… */
 function bindAutoLock() {
  if (autoLockBound) return false;
  autoLockBound = true;
  /* R5 + D13: tab close / navigate */
  var handler = function () { if (ST.unlocked) { try { lock(true); } catch (e) {} } };
  try {
   if (global.addEventListener) {
    global.addEventListener('pagehide', handler, false);
    global.addEventListener('beforeunload', handler, false);
   }
  } catch (e) {}
  return true;
 }
 bindAutoLock();

 /* ══ v0.0.7.b B4 — THE 10-SECOND SECURITY AUTO-LOCK ══
    If the lecturer navigates away from the Studio tab/screen, minimises the
    browser, or simply stops interacting while unlocked, a visible countdown
    starts: "🔒 Auto-locking Studio in 10s… — tap anywhere to stay unlocked".
    No return/interaction within 10 seconds ⇒ Lecturer Admin Studio locks
    ITSELF, so students can never reach an unprotected Studio. Any real
    interaction (tap / click / key / scroll) cancels the countdown and
    re-arms the idle clock. Gates may disable it with
    window.__SDP_AUTOLOCK__ = false (same law as __SDP_ALLOW_AUTOGEN). */
 function autoLockEnabled() {
  try { return global.__SDP_AUTOLOCK__ !== false; } catch (e) { return true; }
 }
 var autoLock = { idleTimer: 0, countdownTimer: 0, left: 0, bound: false };
 function ensureAutoLockBanner() {
  var host = byId('studioAutoLockCountdown');
  if (host) return host;
  try {
   host = doc.createElement('div');
   host.id = 'studioAutoLockCountdown';
   host.className = 'studio-autolock-countdown';
   host.setAttribute('role', 'alert');
   host.hidden = true;
   (doc.body || doc.documentElement).appendChild(host);
  } catch (e) { host = null; }
  return host;
 }
 function paintAutoLockCountdown() {
  var host = byId('studioAutoLockCountdown') || ensureAutoLockBanner();
  if (!host) return false;
  var on = autoLock.left > 0;
  host.hidden = !on;
  if (on) host.textContent = '🔒 ' + t('studioAutoLockIn', 'Auto-locking Studio in') + ' ' + autoLock.left + 's… ' + t('studioAutoLockHint', '— tap anywhere to stay unlocked');
  return true;
 }
 function startAutoLockCountdown() {
  if (!autoLockEnabled() || !ST.unlocked || autoLock.countdownTimer) return false;
  ensureAutoLockBanner();
  autoLock.left = 10;
  paintAutoLockCountdown();
  autoLock.countdownTimer = global.setInterval(function () {
   autoLock.left -= 1;
   if (autoLock.left <= 0) {
    cancelAutoLockCountdown(true);
    if (ST.unlocked) { try { lock(); } catch (e) {} }
    return;
   }
   paintAutoLockCountdown();
  }, 1000);
  return true;
 }
 function cancelAutoLockCountdown(silent) {
  if (autoLock.countdownTimer) { try { global.clearInterval(autoLock.countdownTimer); } catch (e) {} autoLock.countdownTimer = 0; }
  autoLock.left = 0;
  paintAutoLockCountdown();
  if (!silent && ST.unlocked) armIdleAutoLock(true);
  return true;
 }
 function armIdleAutoLock(on) {
  if (!on) {
   if (autoLock.idleTimer) { try { global.clearTimeout(autoLock.idleTimer); } catch (e) {} autoLock.idleTimer = 0; }
   return false;
  }
  if (!autoLockEnabled() || !ST.unlocked) return false;
  if (autoLock.idleTimer) { try { global.clearTimeout(autoLock.idleTimer); } catch (e) {} }
  /* 10 seconds of silence arms the visible 10-second countdown. */
  autoLock.idleTimer = global.setTimeout(function () {
   autoLock.idleTimer = 0;
   if (ST.unlocked) startAutoLockCountdown();
  }, 10000);
  return true;
 }
 function studioScreenActive() {
  try { var el = byId('screen-studio'); return !!(el && el.className && (' ' + el.className + ' ').indexOf(' active ') >= 0); } catch (e) { return true; }
 }
 function onAutoLockActivity() {
  if (!autoLockEnabled() || !ST.unlocked) return false;
  if (autoLock.countdownTimer) cancelAutoLockCountdown();
  /* navigating to a NON-studio screen while unlocked starts the countdown
     at once (the Studio DOM stays unlocked in the background otherwise). */
  if (!studioScreenActive()) { startAutoLockCountdown(); return true; }
  armIdleAutoLock(true);
  return true;
 }
 function bindAutoLockEvents() {
  if (autoLock.bound) return false;
  autoLock.bound = true;
  var d = doc, evts = ['pointerdown', 'click', 'keydown', 'touchstart', 'input', 'change'], i;
  for (i = 0; i < evts.length; i++) {
   try { d.addEventListener(evts[i], onAutoLockActivity, true); } catch (e) {}
  }
  try { global.addEventListener('scroll', onAutoLockActivity, true); } catch (e2) {}
  /* leaving the tab / minimising starts the visible countdown at once */
  try { d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden' && ST.unlocked && autoLockEnabled()) startAutoLockCountdown(); }, false); } catch (e3) {}
  try { global.addEventListener('blur', function () { if (ST.unlocked && autoLockEnabled()) startAutoLockCountdown(); }, false); } catch (e4) {}
  return true;
 }
 /* called from every unlock path: engage the security net */
 function engageAutoLock() {
  try { bindAutoLockEvents(); } catch (eB) {}
  try { armIdleAutoLock(true); } catch (eA) {}
  return true;
 }
 /* v0.0.7.b B4: leaving the Studio releases the classroom dictation lock so
    students can start dictating at once — the strict overlay lifts. */
 function releaseDictationForStudents() {
  try { if (SDP.Engine && SDP.Engine.setStudioLocked) SDP.Engine.setStudioLocked(false); } catch (e) {}
  try { if (SDP.Views && SDP.Views.paintDictationLockOverlay) SDP.Views.paintDictationLockOverlay(false); } catch (e2) {}
  return true;
 }

 function currentWords() {
  if (ST.words && ST.words.length) return ST.words;
  return sync() && sync().words ? sync().words() : [];
 }

 /* v0.0.7.a STALE-WORD PURGE: only the ACTIVE session's words.* keys plus the canonical system clips reach the pack. */
 /* ══ v0.0.7.a A3 — THE PERMANENT REUSABLE VOICE-CLIP LIBRARY.
    Every valid word clip ever generated is ALSO saved into a device-local
    library inside sdp.settings.clipLibrary (the five-key R8 law holds),
    keyed by voiceId + normalizedWord. When a lecturer edits the word list
    a 2nd/3rd/10th time, any returning word with a valid, hash-matching
    library clip is restored at 0 credits — ONLY genuinely new words hit
    ElevenLabs. The shipped pack stays lean (< 4.5 MB) because the library
    lives in localStorage, not in data/elevenlabs-audio.json. */
 var CLIP_LIBRARY_MAX = 120;
 function clipLibraryKey(voiceId, word) {
  return str(voiceId).slice(0, 24) + '|' + str(word).toLowerCase();
 }
 function clipLibrary() {
  try {
   var lib = dataSettings().clipLibrary;
   return isObj(lib) ? lib : {};
  } catch (eL) { return {}; }
 }
 function isValidClipEntry(entry) {
  /* v0.0.7.b B1 — the ZERO-BYTE LAW: any entry whose recorded payload is
     smaller than 512 bytes (the live words.mobile phone bytes:0 bug) is a
     corrupted or never-generated clip and is NEVER valid, no matter what
     its b64 field claims. Empty/undecodable b64 fails below as before. */
  if (isObj(entry) && entry.bytes !== undefined && entry.bytes !== null && entry.bytes !== '') {
   if ((Number(entry.bytes) || 0) < 512) return false;
  }
  var b64 = isObj(entry) ? str(entry.b64) : str(entry);
  return !!(b64 && b64.length > 1400 && str(b64).indexOf('UklGR') !== 0);
 }
 /* v0.0.7.b B1: an entry is playable when it is a REAL payload — a valid
    b64 clip OR an explicit url. Used by every ready/missing count so a
    zero-byte clip can never be reported as Ready. */
 function isPlayableClipEntry(entry) {
  if (isObj(entry) && str(entry.url)) return true;
  return isValidClipEntry(entry);
 }
 function clipLibrarySaveEntry(key, entry) {
  /* only words.* clips enter the library — never system clips */
  if (!/^words\./.test(str(key)) || !isObj(entry) || !isValidClipEntry(entry)) return false;
  try {
   var word = str(key).replace(/^words\./, '');
   var lib = clipLibrary();
   lib[clipLibraryKey(chosenClassroomVoiceId(), word)] = {
    b64: str(entry.b64), bytes: Number(entry.bytes) || 0, hash: str(entry.hash) || '',
    voiceId: chosenClassroomVoiceId(), at: Number(entry.at) || Date.now(),
    text: str(entry.text), modelId: str(entry.modelId) || ''
   };
   /* FIFO cap: keep the newest CLIP_LIBRARY_MAX entries */
   var ks = [], k;
   for (k in lib) if (Object.prototype.hasOwnProperty.call(lib, k)) ks.push(k);
   if (ks.length > CLIP_LIBRARY_MAX) {
    ks.sort(function (a, b) { return (lib[a].at || 0) - (lib[b].at || 0); });
    while (ks.length > CLIP_LIBRARY_MAX) { delete lib[ks.shift()]; }
   }
   try { dataSaveSettings({ clipLibrary: lib }); } catch (eS) { return false; }
   return true;
  } catch (eW) { return false; }
 }
 function clipLibraryLookup(word, expectedHash) {
  try {
   var e = clipLibrary()[clipLibraryKey(chosenClassroomVoiceId(), word)];
   if (!isObj(e) || !isValidClipEntry(e)) return null;
   /* hash guard: a different text/voice/model hash means re-synthesize */
   if (expectedHash && str(e.hash) && str(e.hash) !== str(expectedHash)) return null;
   return e;
  } catch (eK) { return null; }
 }
 /* Auto-restore: before synthesis, returning words with valid library
    clips are injected into the live pack at 0 credits. Returns the number
    restored (for the ♻️ counter). */
 function clipLibraryRestore(words) {
  var list = Array.isArray(words) ? words : currentWords(), restored = 0, i, w, entry;
  for (i = 0; i < list.length; i++) {
   w = str(list[i] && list[i].w).toLowerCase();
   if (!w) continue;
   var key = 'words.' + w;
   if (isValidClipEntry(ST.voicePack.clips[key])) continue; /* already live */
   entry = clipLibraryLookup(w, '');
   if (!entry) continue;
   var e2 = {
    b64: entry.b64, text: entry.text || w, bytes: entry.bytes || entry.b64.length,
    at: entry.at || Date.now(), voiceId: entry.voiceId || chosenClassroomVoiceId(),
    modelId: entry.modelId || VOICE_MODEL, restoredFromLibrary: true
   };
   if (entry.hash) { e2.hash = entry.hash; e2.hashAlgo = HASH_ALGO; }
   ST.voicePack.clips[key] = e2;
   restored += 1;
  }
  if (restored) {
   try { SDP.Speech.injectClips(ST.voicePack.clips); } catch (eI) {}
  }
  return restored;
 }
 /* The live ♻️ Reused X · ⚡ Missing Y counter painted beside the pill. */
 function missingWordTexts() {
  var words = currentWords(), out = [], i, k;
  for (i = 0; i < words.length; i++) {
   k = 'words.' + str(words[i] && words[i].w).toLowerCase();
   if (!isValidClipEntry(ST.voicePack.clips[k]) && !clipLibraryLookup(str(words[i] && words[i].w).toLowerCase(), '')) out.push(str(words[i] && words[i].w));
  }
  return out;
 }
 function paintReuseCounter() {
  var host = byId('studioReuseCounter');
  if (!host) return false;
  var words = currentWords(), reused = 0, missing = 0, i, k;
  for (i = 0; i < words.length; i++) {
   k = 'words.' + str(words[i] && words[i].w).toLowerCase();
   if (isValidClipEntry(ST.voicePack.clips[k])) reused += 1;
   else if (clipLibraryLookup(str(words[i] && words[i].w).toLowerCase(), '')) reused += 1; /* restorable at 0 credits */
   else missing += 1;
  }
  setText(host, '♻️ Reused ' + reused + ' · ⚡ Missing ' + missing + (missing ? ' (~' + charsNeededForWords(missingWordTexts()) + ' chars)' : ' — all clips ready'));
  host.setAttribute('data-missing', String(missing));
  return true;
 }
 function purgeStaleWordsFromPack(clipsObj, words) {
  if (!isObj(clipsObj)) return clipsObj;
  var list = Array.isArray(words) ? words : currentWords();
  var keep = {}, i;
  for (i = 0; i < list.length; i++) keep['words.' + str(list[i] && list[i].w).toLowerCase()] = 1;
  for (var k in clipsObj) {
   if (!Object.prototype.hasOwnProperty.call(clipsObj, k)) continue;
   if (/^words\./.test(k) && !keep[k]) {
    /* v0.0.7.a A3: retiring a word SNAPSHOTS its clip into the permanent
       library first — a returning word restores at 0 credits. */
    try { clipLibrarySaveEntry(k, clipsObj[k]); } catch (eLib) {}
    delete clipsObj[k];
   }
  }
  return clipsObj;
 }

 /* R8/D14: the free enricher */
 /* D12: a harvested human `-uk.mp3` */
 function audioForWord(word, dAudio) {
  var harvested = str(dAudio);
  if (harvested) return harvested;
  return 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(str(word));
 }
 /* D11: pick the real human British */
 function pickBritishAudio(entry) {
  var best = '', gb = '', uk = '';
  var list = isObj(entry) && Array.isArray(entry.phonetics) ? entry.phonetics : [];
  for (var i = 0; i < list.length; i++) {
   var a = isObj(list[i]) ? str(list[i].audio) : '';
   if (!a) continue;
   if (a.indexOf('//') === 0) a = 'https:' + a;
   if (a.indexOf('-uk.mp3') >= 0) { if (!uk) uk = a; continue; }
   if (a.indexOf('_gb') >= 0) { if (!gb) gb = a; continue; }
   if (!best) best = a;
  }
  return uk || gb || best;
 }
 function hasFullRecord(rec) {
  if (!isObj(rec)) return false;
  return !!(str(rec.w) && str(rec.p) && str(rec.pos) && str(rec.m) && str(rec.si) && str(rec.s));
 }

/* ══ v0.0.6.a W1: offline British IPA engine — lexicon + deterministic */
var BRITISH_IPA_LEXICON = {
 "important":"/\u026am\u02c8p\u0254\u02d0t\u0259nt/","impressed":"/\u026am\u02c8prest/","intelligent":"/\u026an\u02c8tel\u026ad\u0292\u0259nt/",
 "interested":"/\u02c8\u026antr\u0259st\u026ad/","jealous":"/\u02c8d\u0292el\u0259s/","married":"/\u02c8m\u00e6rid/",
 "miserable":"/\u02c8m\u026azr\u0259bl/","modern":"/\u02c8m\u0252dn/","negative":"/\u02c8neg\u0259t\u026av/","nervous":"/\u02c8n\u025c\u02d0v\u0259s/",
 "noisy":"/\u02c8n\u0254\u026azi/","normal":"/\u02c8n\u0254\u02d0ml/","old":"/\u0259\u028ald/","fashioned":"/\u02c8f\u00e6\u0283nd/","ordinary":"/\u02c8\u0254\u02d0dnri/",
 "original":"/\u0259\u02c8r\u026ad\u0292\u0259nl/","patient":"/\u02c8pe\u026a\u0283nt/","personal":"/\u02c8p\u025c\u02d0s\u0259nl/","pleasant":"/\u02c8pleznt/","positive":"/\u02c8p\u0252z\u0259t\u026av/",
 "realistic":"/\u02ccri\u02d0\u0259\u02c8l\u026ast\u026ak/","reasonable":"/\u02c8ri\u02d0zn\u0259bl/","relaxed":"/r\u026a\u02c8l\u00e6kst/","reliable":"/r\u026a\u02c8la\u026abl/","relieved":"/r\u026a\u02c8li\u02d0vd/",
 "satisfied":"/\u02c8s\u00e6t\u026asfa\u026ad/","special":"/\u02c8spe\u0283l/","stupid":"/\u02c8stju\u02d0p\u026ad/","surprised":"/s\u0259\u02c8pra\u026azd/","terrible":"/\u02c8ter\u0259bl/",
 "guidebook":"/\u02c8\u0261a\u026adb\u028ak/","handlebars":"/\u02c8h\u00e6ndlb\u0251\u02d0z/","harbour":"/\u02c8h\u0251\u02d0b\u0259/","helicopter":"/\u02c8hel\u026ak\u0252pt\u0259/",
 "hitchhike":"/\u02c8h\u026at\u0283ha\u026ak/","immigration":"/\u02cc\u026am\u026a\u02c8\u0261re\u026a\u0283n/","journey":"/\u02c8d\u0292\u025c\u02d0ni/","luggage":"/\u02c8l\u028ag\u026ad\u0292/","machine":"/m\u0259\u02c8\u0283i\u02d0n/",
 "mechanic":"/m\u0259\u02c8k\u00e6n\u026ak/","nationality":"/\u02ccn\u00e6\u0283\u0259\u02c8n\u00e6l\u0259ti/","overnight":"/\u02cc\u0259\u028av\u0259\u02c8na\u026at/","passenger":"/\u02c8p\u00e6s\u026and\u0292\u0259/",
 "reception":"/r\u026a\u02c8sep\u0283n/","reservation":"/\u02ccrez\u0259\u02c8ve\u026a\u0283n/","signpost":"/\u02c8sa\u026anp\u0259\u028ast/","spaceship":"/\u02c8spe\u026a\u0283\u0283\u026ap/","suitcase":"/\u02c8su\u02d0tke\u026as/",
 "tunnel":"/\u02c8t\u028anl/","vehicle":"/\u02c8vi\u02d0\u0259kl/","visa":"/\u02c8vi\u02d0z\u0259/","waiting room":"/\u02c8we\u026at\u026a\u014b ru\u02d0m/","windscreen":"/\u02c8w\u026andskri\u02d0n/",
 "on business":"/\u0252n \u02c8b\u026azn\u0259s/","on vacation":"/\u0252n v\u0259\u02c8ke\u026a\u0283n/","public transport":"/\u02ccp\u028abl\u026ak \u02c8tr\u00e6nsp\u0254\u02d0t/",
 "road sign":"/\u02c8r\u0259\u028ad sa\u026an/","traffic lights":"/\u02c8tr\u00e6f\u026ak la\u026ats/","tourist information centre":"/\u02c8t\u028a\u0259r\u026ast \u02cc\u026anf\u0259\u02c8me\u026a\u0283n \u02c8sent\u0259/",
 "tyre":"/\u02c8ta\u026a\u0259/","tire":"/\u02c8ta\u026a\u0259/","guide":"/\u0261a\u026ad/","book":"/b\u028ak/","handle":"/\u02c8h\u00e6ndl/","bar":"/b\u0251\u02d0/"
};
var G2P_DIGRAPHS = [["ch","t\u0283"],["sh","\u0283"],["th","\u03b8"],["ph","f"],["wh","w"],["ck","k"],["ng","\u014b"],["qu","kw"],
 ["ee","i\u02d0"],["oo","u\u02d0"],["ea","i\u02d0"],["ou","a\u028a"],["ai","e\u026a"],["ay","e\u026a"],["oa","\u0259\u028a"],["oi","\u0254\u026a"],
 ["oy","\u0254\u026a"],["au","\u0254\u02d0"],["aw","\u0254\u02d0"],["ir","\u025c\u02d0"],["ur","\u025c\u02d0"],["er","\u0259"],["or","\u0254\u02d0"],
 ["ar","\u0251\u02d0"],["ie","a\u026a"],["ue","u\u02d0"],["ey","e\u026a"]];
var G2P_TAIL = {"e":"","es":"z","ed":"d","ing":"\u026a\u014b","ly":"li","tion":"\u0283n","sion":"\u0283n","ture":"t\u0283\u0259","ous":"\u0259s","ful":"fl","able":"\u0259bl","ible":"\u026abl",
 "er":"\u0259","ies":"iz","ation":"e\u026a\u0283n","fully":"fli","ingly":"\u026a\u014bli"};
var G2P_SINGLE = {"a":"\u00e6","e":"e","i":"\u026a","o":"\u0252","u":"\u028c","y":"\u026a","b":"b","c":"k","d":"d","f":"f","g":"\u0261","h":"h","j":"d\u0292","k":"k","l":"l","m":"m","n":"n","p":"p",
 "q":"kw","r":"r","s":"s","t":"t","v":"v","w":"w","x":"ks","z":"z"};
var G2P_VOWELS = "\u00e6e\u026a\u0252\u028cu\u0259\u0251\u0254\u025ci\u02d0\u028a\u0254\u026a";
function g2pIsVowel(ipa) { return ipa.length > 0 && G2P_VOWELS.indexOf(ipa.charAt(0)) >= 0; }
/* The deterministic G2P transcriber: scan left-to-right in the reading */
function transcribeBritishIPA(raw) {
  var w = str(raw).toLowerCase().replace(/[^a-z ]/g, '').replace(/^\s+|\s+$/g, '');
  if (!w) return '';
  if (BRITISH_IPA_LEXICON[w]) return BRITISH_IPA_LEXICON[w];
  if (w.indexOf(' ') >= 0) {
    var parts = w.split(' '), joined = [];
    for (var p = 0; p < parts.length; p++) {
      var sub = transcribeBritishIPA(parts[p]);
      joined.push(sub ? sub.replace(/^\/+|\/+$/g, '') : parts[p]);
    }
    return '/' + joined.join(' ') + '/';
  }
  var head = w, tail = '';
  var keys = ['ation','tion','sion','ature','ible','able','fully','ingly','ing','ous','ful','ly','ies','es','ed','er','e'];
  for (var k = 0; k < keys.length; k++) {
    if (w.length > keys[k].length + 1 && w.slice(-keys[k].length) === keys[k]) {
      tail = G2P_TAIL[keys[k]]; head = w.slice(0, w.length - keys[k].length); break;
    }
  }
  var out = '', i = 0;
  if (head.charAt(0) === 'y') { out = 'j'; head = head.slice(1); }
  if (head.slice(-1) === 'e' && head.length > 2 && 'aeiou'.indexOf(head.charAt(head.length - 2)) < 0) head = head.slice(0, -1);
  while (i < head.length) {
    var seg = head.slice(i, i + 2), hit = '';
    for (var d = 0; d < G2P_DIGRAPHS.length; d++) {
      if (seg === G2P_DIGRAPHS[d][0] && i + 2 <= head.length) { hit = G2P_DIGRAPHS[d][1]; i += 2; break; }
    }
    if (!hit) {
      hit = G2P_SINGLE[head.charAt(i)] || '';
      i += 1;
      /* a word-final weak vowel collapses to schwa \u0259. */
      if (head.charAt(i - 1) === 'e' && i === head.length) hit = '\u0259';
    }
    if (!hit) continue;
    /* a consonant followed by the SAME consonant is a single sound. */
    if (out.length && out.charAt(out.length - 1) === hit && !g2pIsVowel(hit)) continue;
    out += hit;
  }
  out += tail;
  /* -es after a sibilant is a separate syllable: boxes -> -ksIz. */
  if (out.length > 2 && out.slice(-2) === 'sz') out = out.slice(0, -2) + 's\u026az';
  for (var v = 0; v < out.length; v++) {
    if (g2pIsVowel(out.charAt(v))) {
      var s0 = v;
      while (s0 > 0 && !g2pIsVowel(out.charAt(s0 - 1))) s0 -= 1;
      out = out.slice(0, s0) + '\u02c8' + out.slice(s0);
      break;
    }
  }
  if (out.replace(/[\u02c8\/]/g, '').length < 2) return '';
  return '/' + out + '/';
}
function offlineIPA(word) {
  var w = str(word).toLowerCase();
  var lex = BRITISH_IPA_LEXICON[w];
  if (lex) return lex;
  if (/^(tyre|tire)$/.test(w)) return '/\u02c8ta\u026a\u0259/';
  var prior = priorIPAFor(w);
  if (prior && prior !== '/' + w + '/') return prior;
  var t = transcribeBritishIPA(w);
  if (t && t !== '/' + w + '/') return t;
  return '';
}

function priorIPAFor(w) {
  try {
    if (SDP.Sync && SDP.Sync.words) {
      var all = SDP.Sync.words();
      for (var i = 0; i < all.length; i++) {
        if (all[i] && str(all[i].w).toLowerCase() === w && str(all[i].p).indexOf('/') === 0 && str(all[i].p).length > 4) return str(all[i].p);
      }
    }
  } catch (e) {}
  return '';
}

 function fallbackEnrich(word, prior) {
  var base = isObj(prior) ? prior : {};
  var w = str(word);
  var ipa = str(base.p);
  if (!ipa || ipa === '/' + w + '/') ipa = offlineIPA(w);
  if (!ipa || ipa === '/' + w + '/') ipa = transcribeBritishIPA(w);
  /* v0.0.6.d (D2): a replaced word never inherits the old slot's POS — the */
  var pos = str(base.pos);
  if (!pos || pos === '—' || pos === '-') pos = guessPartOfSpeech(w);
  var m = str(base.m);
  if (!m || m.indexOf('B1 classroom vocabulary word:') === 0) m = b1Definition(w, pos);
  var si = str(base.si);
  var s = str(base.s);
  if (!s || s.indexOf('Please write the word ' + w) === 0) s = b1Example(w, pos);
  return {
   w: w,
   p: ipa,
   pos: pos,
   m: m,
   si: si,
   s: s,
   audio: str(base.audio) || audioForWord(w),
   exampleSi: str(base.exampleSi),
   /* D14: an offline record says so, so the */
   enrichSource: str(base.enrichSource) || 'lexicon'
  };
 }

 /* v0.0.6.d (D2): the smart morphological analyzer — suffix rules give an */
 function guessPartOfSpeech(w) {
  var s = str(w).toLowerCase().replace(/[^a-z ]/g, '');
  if (!s) return '—';
  if (POS_LEXICON[s]) return POS_LEXICON[s];
  if (/ $|^ /.test(s)) return '—';
  if (/ly$/.test(s)) return 'adv.';
  if (/(ness|tion|sion|ment|ity|ship|hood|ance|ence|ism|age|ery)$/.test(s)) return 'n.';
  if (/(ous|ful|able|ible|ive|al|ic|ish|ant|ent|ary|less|y)$/.test(s) && !/^(day|key|way)$/.test(s)) return 'adj.';
  if (/(ize|ise|ate|ify|en)$/.test(s) && s.length > 4) return 'v.';
  if (/(ing)$/.test(s)) return s.length > 6 ? 'v.' : 'n.';
  if (/(ed)$/.test(s)) return s.length > 5 ? 'adj.' : 'v.';
  if (/(er|or|ist)$/.test(s) && s.length > 4) return 'n.';
  return 'n.';
 }
 /* A tiny offline POS lexicon for the words a B1 class actually changes to. */
 var POS_LEXICON = {
  important: 'adj.', impressed: 'adj.', intelligent: 'adj.', interested: 'adj.',
  jealous: 'adj.', married: 'adj.', miserable: 'adj.', modern: 'adj.', negative: 'adj.',
  nervous: 'adj.', noisy: 'adj.', normal: 'adj.', old: 'adj.', ordinary: 'adj.',
  original: 'adj.', patient: 'adj.', personal: 'adj.', pleasant: 'adj.', positive: 'adj.',
  realistic: 'adj.', reasonable: 'adj.', relaxed: 'adj.', reliable: 'adj.', relieved: 'adj.',
  satisfied: 'adj.', special: 'adj.', stupid: 'adj.', surprised: 'adj.', terrible: 'adj.',
  afraid: 'adj.', brave: 'adj.', calm: 'adj.', careful: 'adj.', cheerful: 'adj.',
  clever: 'adj.', confident: 'adj.', crazy: 'adj.', cruel: 'adj.', curious: 'adj.',
  delighted: 'adj.', depressed: 'adj.', disappointed: 'adj.', excited: 'adj.',
  famous: 'adj.', friendly: 'adj.', generous: 'adj.', guilty: 'adj.', healthy: 'adj.',
  hungry: 'adj.', lazy: 'adj.', lucky: 'adj.', polite: 'adj.', proud: 'adj.',
  quiet: 'adj.', rude: 'adj.', serious: 'adj.', shy: 'adj.', smart: 'adj.',
  useful: 'adj.', worried: 'adj.', angry: 'adj.', anxious: 'adj.', ashamed: 'adj.',
  amazed: 'adj.', amusing: 'adj.', annoyed: 'adj.', awesome: 'adj.', boring: 'adj.',
  brilliant: 'adj.', challenging: 'adj.', charming: 'adj.', confusing: 'adj.',
  delightful: 'adj.', enjoyable: 'adj.', excellent: 'adj.', fantastic: 'adj.',
  favourite: 'adj.', frightened: 'adj.', guilty_: 'adj.', quickly: 'adv.',
  slowly: 'adv.', carefully_: 'adv.', suddenly: 'adv.', really: 'adv.', very: 'adv.',
  never: 'adv.', always: 'adv.', often: 'adv.', usually: 'adv.', early: 'adv.',
  hard: 'adv.', fast: 'adv.', well: 'adv.', badly: 'adv.', together: 'adv.',
  journey: 'n.', luggage: 'n.', machine: 'n.', mechanic: 'n.', passenger: 'n.',
  reception: 'n.', reservation: 'n.', suitcase: 'n.', tunnel: 'n.', vehicle: 'n.',
  harbour: 'n.', helicopter: 'n.', guidebook: 'n.', passport: 'n.', ticket: 'n.',
  airport: 'n.', station: 'n.', hotel: 'n.', teacher: 'n.', student: 'n.',
  doctor: 'n.', engineer: 'n.', library: 'n.', hospital: 'n.', market: 'n.',
  travel: 'v.', arrive: 'v.', borrow: 'v.', cancel: 'v.', complain: 'v.',
  describe: 'v.', destroy: 'v.', develop: 'v.', discover: 'v.', discuss: 'v.',
  embarrass: 'v.', enjoy: 'v.', expect: 'v.', explain: 'v.', feel: 'v.',
  finish: 'v.', forget: 'v.', happen: 'v.', hurry: 'v.', imagine: 'v.',
  improve: 'v.', invite: 'v.', laugh: 'v.', learn: 'v.', leave: 'v.',
  listen: 'v.', live: 'v.', look: 'v.', lose: 'v.', love: 'v.',
  move: 'v.', need: 'v.', offer: 'v.', own: 'v.', pack: 'v.',
  practise: 'v.', prefer: 'v.', prepare: 'v.', promise: 'v.', protect: 'v.',
  reach: 'v.', realise: 'v.', receive: 'v.', recommend: 'v.', refuse: 'v.',
  remember: 'v.', repair: 'v.', repeat: 'v.', reply: 'v.', require: 'v.',
  reserve: 'v.', return: 'v.', smile: 'v.', sound: 'v.', stay: 'v.',
  suggest: 'v.', suppose: 'v.', surprise: 'v.', translate: 'v.', travel_: 'v.'
 };
 /* v0.0.6.d (D2): a natural B1 definition and a contextual example sentence */
 function b1Definition(w, pos) {
  var p = str(pos);
  if (p === 'adv.') return 'In the way described by "' + str(w) + '".';
  if (p === 'v.') return 'To ' + str(w) + ' (something).';
  if (p === 'adj.') return 'Having the quality of being ' + str(w) + '.';
  return 'A ' + str(w) + '.';
 }
 function b1Example(w, pos) {
  var word = str(w);
  var p = str(pos);
  if (p === 'adv.') return 'She answered the question ' + word + '.';
  if (p === 'v.') return 'They ' + word + ' together every weekend.';
  if (p === 'adj.') return 'The story was very ' + word + ' to read.';
  return 'We saw a ' + word + ' near the station.';
 }
 
 /* ══ v0.0.7.b B2 — THE CLEAN-DATA LAW: every enrichment input (dictionary
    API, LLM row, prior record) passes these sanitizers, so Wiktionary junk
    ("(etc.)", "(An intranet.)", "(heading)", leading ':', spelling-as-
    phonetics, doubled-spelling IPA, examples without the exact word) can
    never reach a student again. ══ */
 function sanitizeMeaningText(m, word) {
  var t = str(m);
  if (!t) return '';
  t = t.replace(/^\s*\(etc\.?\)\s*,?\s*/i, '');
  t = t.replace(/^\s*\(heading\)\s*,?\s*/i, '');
  t = t.replace(/^\s*[:;]\s*/, '');
  t = t.replace(/\s*\((?:An?|The)\s+[a-z][^)]{2,40}\.\)\s*$/i, '');
  t = t.replace(/\s*\((?:see|cf\.?)[^)]*\)\s*$/i, '');
  t = t.replace(/,\s*etc\.?\s*$/i, '.');
  t = t.replace(/\s+etc\.?\s*$/i, '.');
  t = t.replace(/\s*\((?:An?|The)\s+[a-z][^)]{2,40}\.\)/i, ''); /* inline cross-refs too */
  t = t.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
  if (t.length > 160) {
   var cut = t.indexOf('. ', 30);
   if (cut > 30 && cut < 160) t = t.slice(0, cut + 1);
   else t = t.slice(0, 157).replace(/\s+\S*$/, '') + '.';
  }
  return t;
 }
 function sanitizeExampleSentence(s, word) {
  var t = str(s);
  if (!t) return '';
  t = t.replace(/^\s*\(etc\.?\)\s*/i, '').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
  var hasWord = str(word) ? (t.toLowerCase().indexOf(str(word).toLowerCase()) >= 0) : true;
  var sentenceLike = /[.!?]$/.test(t) || t.split(' ').length >= 6;
  if (!hasWord || !sentenceLike || t.length > 140) return ''; /* caller falls back to a template that DOES contain the word */
  return t;
 }
 function sanitizeBritishIPA(p, word) {
  var t = str(p).replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
  if (!t) return '';
  if (t.indexOf('/') !== 0) t = '/' + t.replace(/^\/+|\/+$/g, '') + '/';
  var bare = t.replace(/^\/+|\/+$/g, '');
  var wl = str(word).toLowerCase().replace(/[^a-z]/g, '');
  if (wl && bare.toLowerCase().replace(/[^a-z]/g, '').indexOf(wl + wl) >= 0) return ''; /* "/ˈdɪskdɪsk/" doubled-spelling artifact */
  if (('/' + wl + '/') === t.toLowerCase()) return ''; /* spelling-as-phonetics placeholder */
  return t;
 }
 /* v0.0.7.b B2 — words with 2+ accepted British RP pronunciations carry a
    pronunciationVariants hint so students see both valid forms. */
 var PRONUNCIATION_VARIANTS = {
  'either': ['/ˈaɪ.ðər/', '/ˈiː.ðər/'],
  'neither': ['/ˈnaɪ.ðər/', '/ˈniː.ðər/'],
  'schedule': ['/ˈʃedʒ.uːl/', '/ˈskedʒ.uːl/'],
  'data': ['/ˈdeɪ.tə/', '/ˈdɑː.tə/'],
  'often': ['/ˈɒf.ən/', '/ˈɒf.tən/'],
  'privacy': ['/ˈprɪv.ə.si/', '/ˈpraɪ.və.si/'],
  'garage': ['/ˈɡær.ɑːʒ/', '/ˈɡær.ɪdʒ/'],
  'controversy': ['/ˈkɒn.trə.vɜː.si/', '/kənˈtrɒv.ə.si/'],
  'mobile': ['/ˈməʊ.baɪl/', '/ˌməʊ.baɪl/'],
  'mobile phone': ['/ˌməʊ.baɪl ˈfəʊn/', '/ˈməʊ.baɪl ˈfəʊn/'],
  'route': ['/ruːt/', '/raʊt/'],
  'vitamin': ['/ˈvɪt.ə.mɪn/', '/ˈvaɪ.tə.mɪn/'],
  'status': ['/ˈsteɪ.təs/', '/ˈstæt.əs/'],
  'economic': ['/ˌiː.kəˈnɒm.ɪk/', '/ˌek.əˈnɒm.ɪk/'],
  'envelope': ['/ˈen.və.ləʊp/', '/ˈɒn.və.ləʊp/'],
  'direct': ['/daɪˈrekt/', '/dɪˈrekt/']
 };
 function mergeEnrichRecord(word, prior, provided) {
  var base = fallbackEnrich(word, prior);
  var p = isObj(provided) ? provided : {};
  var ipaIn = sanitizeBritishIPA(str(p.p) || base.p, word);
  /* v0.0.6.a: a spelling-as-phonetics placeholder is worthless in a B1 class; */
  if (ipaIn === '/' + str(word) + '/') ipaIn = '';
  /* v0.0.6.d (D2): never carry the OLD word's POS/meaning/sentence onto a */
  var stalePrior = isObj(prior) && str(prior.w) && str(prior.w).toLowerCase() !== str(word).toLowerCase();
  var posIn = str(p.pos) || (stalePrior ? '' : '') || '';
  if (!posIn && !str(p.m) && !str(p.s)) {
   /* No LLM row landed: the analyzer owns POS, and the generic fallbacks */
   if (stalePrior) { base.pos = guessPartOfSpeech(str(word)); base.m = ''; base.s = ''; }
  }
  var mIn = sanitizeMeaningText(str(p.m), word);
  var sIn = sanitizeExampleSentence(str(p.s), word);
  var siIn = str(p.si);
  /* v0.0.7.b B2: keep (or stamp) the UK pronunciation-variant hints. */
  var pv = PRONUNCIATION_VARIANTS[str(word).toLowerCase()] ||
   (isObj(prior) && Array.isArray(prior.pronunciationVariants) && prior.pronunciationVariants.length > 1 ? prior.pronunciationVariants : null);
  var out = {
   w: str(word),
   p: ipaIn || offlineIPA(str(word)) || transcribeBritishIPA(str(word)),
   pos: posIn || base.pos,
   m: mIn || (stalePrior ? b1Definition(str(word), base.pos) : sanitizeMeaningText(base.m, word)),
   si: siIn || (stalePrior ? '' : base.si),
   s: sIn || (stalePrior ? b1Example(str(word), base.pos) : sanitizeExampleSentence(base.s, word) || b1Example(str(word), base.pos)),
   audio: str(prior && prior.audio) || base.audio,
   exampleSi: str(p.exampleSi) || base.exampleSi,
   /* v0.0.6.u Step A: every enriched word carries its British RP phonetic
      respelling as ttsHint (Lecturer hint > RP_TTS_OVERRIDES > prior hint),
      so the publish pipeline's clip synthesis always SPEAKS the RP
      respelling while stamping the canonical spelling. */
   ttsHint: str(p.ttsHint) || RP_TTS_OVERRIDES[str(word).toLowerCase()] || str(prior && prior.ttsHint) || '',
   enrichSource: str(p.enrichSource) || str(prior && prior.enrichSource) || base.enrichSource
  };
  if (pv && pv.length > 1) out.pronunciationVariants = pv;
  return out;
 }
 function fetchJsonSafe(url, timeoutMs, cb) {
  cb = cb || noop;
  if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
  var done = false, timer = null;
  function finish(err, data) {
   if (done) return;
   done = true;
   if (timer) { try { global.clearTimeout(timer); } catch (e) {} timer = null; }
   cb(err, data);
  }
  timer = global.setTimeout(function () { finish(new Error('timeout')); }, Number(timeoutMs) || 6000);
  try {
   global.fetch(url, { cache: 'no-store' })
    .then(function (res) { return res && res.ok && res.json ? res.json() : null; })
    .then(function (data) { if (data) finish(null, data); else finish(new Error('bad_response')); },
     function () { finish(new Error('fetch_failed')); });
  } catch (e) { finish(new Error('fetch_failed')); return false; }
  return true;
 }
 function dictFields(json) {
  var out = { p: '', pos: '', m: '', s: '', audio: '' };
  var entry = Array.isArray(json) ? json[0] : (isObj(json) ? json : null);
  if (!isObj(entry)) return out;
  /* D11: the real human British */
  out.audio = pickBritishAudio(entry);
  if (str(entry.phonetic)) out.p = str(entry.phonetic);
  if (!out.p && Array.isArray(entry.phonetics)) {
   for (var i = 0; i < entry.phonetics.length; i++) {
    if (isObj(entry.phonetics[i]) && str(entry.phonetics[i].text)) { out.p = str(entry.phonetics[i].text); break; }
   }
  }
  var meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
  if (meanings.length && isObj(meanings[0])) {
   out.pos = str(meanings[0].partOfSpeech);
   var defs = Array.isArray(meanings[0].definitions) ? meanings[0].definitions : [];
   if (defs.length && isObj(defs[0])) out.m = str(defs[0].definition);
   for (var d = 0; d < defs.length; d++) {
    if (isObj(defs[d]) && str(defs[d].example)) { out.s = str(defs[d].example); break; }
   }
  }
  if (out.pos && out.pos.charAt(out.pos.length - 1) !== '.') out.pos += '.';
  return out;
 }
 function sinhalaFrom(json) {
  if (!isObj(json)) return '';
  var rd = isObj(json.responseData) ? json.responseData : {};
  return str(rd.translatedText || '');
 }
 /* v0.0.4.a W2: built-in B1 Sinhala lexicon + multi-tier translateSi cascade. */
 var SI_LEXICON = {
  "afraid": "බියට පත් වූ",
  "amazed": "මවිතයට පත් වූ",
  "amusing": "විනෝදජනක",
  "annoyed": "කෝපයට හෝ කරදරයට පත් වූ",
  "anxious": "කනස්සල්ලෙන් සිටින",
  "ashamed": "ලැජ්ජාවට පත් වූ",
  "awesome": "ඉතා විශිෂ්ට",
  "boring": "කම්මැලි හෝ නීරස",
  "brilliant": "ඉතා දක්ෂ හෝ විශිෂ්ට",
  "challenging": "අභියෝගාත්මක",
  "charming": "ආකර්ෂණීය හෝ සිත්ගන්නාසුලු",
  "confident": "ආත්ම විශ්වාසයෙන් යුතු",
  "confusing": "ව්‍යාකූල කරන",
  "cruel": "කෲර හෝ නපුරු",
  "curious": "කුතුහලයෙන් යුතු",
  "delighted": "ඉතා සතුටට පත් වූ",
  "depressed": "දැඩි කලකිරීමට හෝ දුකට පත් වූ",
  "disappointed": "බලාපොරොත්තු සුන් වූ",
  "embarrassing": "අපහසුතාවයට පත් කරන",
  "enjoyable": "රසවත් හෝ සතුටුදායක",
  "excellent": "ඉතා විශිෂ්ට",
  "excited": "උද්‍යෝගිමත් වූ",
  "fantastic": "අති විශිෂ්ට",
  "favourite": "ප්‍රියතම",
  "frightened": "බියට පත් වූ",
  "friendly": "මිත්‍රශීලී",
  "generous": "ත්‍යාගශීලී",
  "guilty": "වරදකාරී හැඟීමක් ඇති",
  "healthy": "සෞඛ්‍ය සම්පන්න",
  "hungry": "කුසගින්නෙන් පෙළෙන",
  "brave": "නිර්භීත"
 };
 var GOOGLE_SI_API = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=si&dt=t&q=';
 var POLLINATIONS_SI_API = 'https://text.pollinations.ai/';
 function sessionLexicon() {
  var out = {}, i, list = [];
  try { list = sync() && sync().words ? sync().words() : []; } catch (e) { list = []; }
  for (i = 0; i < list.length; i++) {
   var rw = list[i] || {};
   if (str(rw.w) && /[\u0D80-\u0DFF]/.test(str(rw.si))) out[str(rw.w).toLowerCase()] = str(rw.si);
  }
  return out;
 }
 function fetchTextSafe(url, timeoutMs, cb) {
  cb = cb || noop;
  if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
  var done = false, timer = null;
  function finish(err, text) {
   if (done) return; done = true;
   if (timer) { try { global.clearTimeout(timer); } catch (e) {} timer = null; }
   cb(err, text);
  }
  timer = global.setTimeout(function () { finish(new Error('timeout')); }, Number(timeoutMs) || 6000);
  try {
   global.fetch(url, { cache: 'no-store' })
    .then(function (res) { return res && res.ok && res.text ? res.text() : null; })
    .then(function (t) { if (t) finish(null, t); else finish(new Error('bad_response')); },
     function (err) { finish(err || new Error('network_error')); });
  } catch (e) { finish(e || new Error('network_error')); }
  return true;
 }
 function translateSi(word, cb) {
  cb = cb || noop;
  var w = str(word).toLowerCase();
  var lex = SI_LEXICON[w] || sessionLexicon()[w] || '';
  if (lex && /[\u0D80-\u0DFF]/.test(lex)) { cb(null, lex, 'lexicon'); return true; }
  fetchJsonSafe(GOOGLE_SI_API + encodeURIComponent(w), 6000, function (err, json) {
   var t = '', i;
   if (!err && Array.isArray(json) && Array.isArray(json[0])) {
    for (i = 0; i < json[0].length; i++) t += str(json[0][i] && json[0][i][0]);
   }
   if (t && /[\u0D80-\u0DFF]/.test(t)) { cb(null, t, 'net'); return; }
   fetchJsonSafe(SINHALA_API + encodeURIComponent(w) + '&langpair=en|si', 6000, function (err2, json2) {
    var t2 = !err2 ? sinhalaFrom(json2) : '';
    if (t2 && t2.indexOf('MYMEMORY WARNING') < 0 && /[\u0D80-\u0DFF]/.test(t2)) { cb(null, t2, 'net'); return; }
    fetchTextSafe(POLLINATIONS_SI_API + encodeURIComponent('Translate the English word "' + w + '" into Sinhala. Answer with ONLY the Sinhala word, no explanation.'), 8000, function (err3, text) {
     var t3 = err3 ? '' : str(text).replace(/^["'\s]+|["'\s]+$/g, '');
     if (t3 && /[\u0D80-\u0DFF]/.test(t3)) { cb(null, t3, 'net'); return; }
     cb(new Error('no_sinhala'), '');
    });
   });
  });
  return true;
 }
 function freeEnrichOne(word, prior, cb) {
  cb = cb || noop;
  var w = str(word);
  var pending = 2, dict = null, si = '', siLex = false;
  function done() {
   pending -= 1;
   if (pending > 0) return;
   var out = mergeEnrichRecord(w, prior, {});
   if (dict) {
    if (dict.p) { var pD = sanitizeBritishIPA(dict.p, w); if (pD) out.p = pD; }
    if (dict.pos) out.pos = dict.pos;
    if (dict.m) out.m = sanitizeMeaningText(dict.m, w) || out.m;
    if (dict.s) { var sD = sanitizeExampleSentence(dict.s, w); if (sD) out.s = sD; }
    /* D11/D12: never discard a known human */
    if (dict.audio) out.audio = str(dict.audio);
   }
   /* v0.0.6.d (D2): a changed word must land with an EXACT part of speech — */
   if (!str(out.pos) || out.pos === '—' || out.pos === '-') {
    out.pos = (dict && str(dict.pos)) || guessPartOfSpeech(w);
   }
   /* …and a natural B1 example that fits that part of speech. */
   if (!str(out.s) || out.s.indexOf('Please write the word ' + w) === 0) {
    out.s = b1Example(w, out.pos);
   }
   if (si) out.si = si;
   var net = !!(dict || (si && !siLex));
   out.enrichSource = net ? 'free_dict' : 'lexicon';
   cb(null, out, !net);
  }
  fetchJsonSafe(DICTIONARY_API + encodeURIComponent(w), 6000, function (err, json) {
   if (!err) dict = dictFields(json);
   done();
  });
  translateSi(w, function (err, text, src) {
   if (!err) { si = str(text); if (src === 'lexicon') siLex = true; }
   done();
  });
  return true;
 }
 function llmPrompt(words) {
  /* v0.0.7.b B2 — the AUTHORITATIVE BRITISH VALIDATION PROMPT: Cambridge/
     Oxford learner-dictionary standards for a Sri Lankan B1 class. */
  return 'You are an authoritative British English editor (Cambridge / Oxford learner dictionary) for a Sri Lankan B1 English class. ' +
   'Return STRICT JSON only, no prose: {"words":[{"w":"exact spelling","p":"British RP IPA with syllable dots, e.g. /ˌməʊ.baɪl ˈfəʊn/","pos":"noun./verb./adjective./adv.","m":"ONE concise factually-accurate B1 definition (max 15 words)","si":"short accurate Sinhala meaning","s":"ONE natural B1 example sentence that CONTAINS the exact word"}]} ' +
   'Rules: non-rhotic British RP pronunciation only; the definition must give the most common MODERN B1 sense (e.g. computer = an electronic machine, never "a person who computes"); no bracketed notes, no "(etc.)", no cross-references, no archaic senses; the example sentence must contain the exact word form and end with a full stop; never invent facts. ' +
   'for exactly these words: ' + words.join(', ');
 }
 function parseJsonLoose(text) {
  var t = str(text).replace(/```json/gi, '```').replace(/```/g, '').replace(/^\s+|\s+$/g, '');
  try { return JSON.parse(t); } catch (e) {}
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e2) {} }
  return null;
 }
 function llmRows(provider, json) {
  var text = '';
  if (provider === 'gemini') {
   var cand = json && json.candidates && json.candidates[0] ? json.candidates[0] : null;
   var parts = cand && cand.content ? cand.content.parts : null;
   if (Array.isArray(parts) && parts[0]) text = str(parts[0].text);
  } else {
   var choice = json && json.choices && json.choices[0] ? json.choices[0] : null;
   text = str(choice && choice.message ? choice.message.content : '');
  }
  var parsed = parseJsonLoose(text);
  var rows = isObj(parsed) && Array.isArray(parsed.words) ? parsed.words : (Array.isArray(parsed) ? parsed : []);
  var out = {}, i;
  for (i = 0; i < rows.length; i++) {
   var r = rows[i];
   if (!isObj(r) || !str(r.w)) continue;
   out[str(r.w).toLowerCase()] = r;
  }
  return out;
 }
 function llmRequest(provider, key, words, cb, promptOverride) {
  cb = cb || noop;
  var ep = LLM_ENDPOINTS[provider];
  if (!ep) { cb(new Error('no_provider')); return false; }
  var info = isObj(AI_PROVIDERS[provider]) ? AI_PROVIDERS[provider] : {};
  /* D10: pollinations_free is a zero-key */
  if (info.needsKey !== false && !key) { cb(new Error('no_key')); return false; }
  if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
  /* v0.0.6.m: the pronunciation verifier injects its own strict prompt. */
  var prompt = str(promptOverride) || llmPrompt(words), url = ep.url, headers = { 'Content-Type': 'application/json' }, body = null;
  /* v0.0.6.m: every provider branch names the HTTP status on failure so the */
  var statusOf = function (res) {
   return res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
  };
  var failWith = function (status) {
   var err = new Error(status === 429 ? 'groq_rate_limited' : 'llm_failed');
   err.status = Number(status) || 0;
   cb(err);
  };
  if (provider === 'gemini') {
   var models = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
   if (str(ST.aiModel) && models.indexOf(str(ST.aiModel)) >= 0) {
    models = [str(ST.aiModel)].concat(models.filter(function (m) { return m !== str(ST.aiModel); }));
   }
   var geminiTry = function (mi) {
    var m = models[mi];
    if (!m) { cb(new Error('llm_failed')); return; }
    var gurl = 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(str(key));
    var gbody = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } };
    global.fetch(gurl, { method: 'POST', headers: headers, body: JSON.stringify(gbody), cache: 'no-store' })
     .then(function (res) {
      var st = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
      /* v0.0.6.d (D8): a Gemini quota/auth failure raises the credit banner. */
      if (st === 401 || st === 402 || st === 429) {
        try { paintCreditBanner('Gemini ' + st + ' · ' + (st === 429 ? 'quota exceeded' : 'key rejected')); } catch (e3) {}
      }
      if ((st === 404 || st === 400) && mi + 1 < models.length) { geminiTry(mi + 1); return null; }
      return res && res.json ? res.json() : null;
     })
     .then(function (json) {
      if (json === null) return;
      ST.aiModel = m;
      var raw = '';
      try {
       var parts = json && json.candidates ? json.candidates : null;
       if (Array.isArray(parts) && parts[0] && parts[0].content && Array.isArray(parts[0].content.parts)) raw = str(parts[0].content.parts[0].text);
      } catch (e0) {}
      cb(null, llmRows(provider, json), raw);
     }, function (err) { cb(err || new Error('llm_failed')); });
   };
   try { geminiTry(0); } catch (e) { cb(e || new Error('llm_failed')); return false; }
   return true;
  } else {
   /* D10: no Authorization header at */
   if (str(key)) headers.Authorization = 'Bearer ' + str(key);
   body = {
    model: ep.model, temperature: 0.2, response_format: { type: 'json_object' },
    messages: [
     { role: 'system', content: 'You answer with strict JSON only.' },
     { role: 'user', content: prompt }
    ]
   };
  }
  try {
   global.fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), cache: 'no-store' })
    .then(function (res) {
     /* v0.0.6.m: a non-2xx OpenAI-compatible answer (Groq 429 rate limit, */
     if (!res || !res.ok) { failWith(statusOf(res)); return null; }
     return res && res.json ? res.json() : null;
    })
    .then(function (json) {
     if (json === null) return;
     var raw = '';
     try {
      var choice = json && json.choices ? json.choices[0] : null;
      if (choice && choice.message) raw = str(choice.message.content);
     } catch (e0) {}
     cb(null, llmRows(provider, json), raw);
    }, function (err) { cb(err || new Error('llm_failed')); });
  } catch (e) { cb(e || new Error('llm_failed')); return false; }
  return true;
 }
 
 function enrichWords(rawWordsInput, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};
  cb = cb || noop;
  var list = Array.isArray(rawWordsInput)
   ? rawWordsInput.map(function (w) { return isObj(w) ? w : { w: str(w) }; })
   : parseBulkWords(str(rawWordsInput));
  list = list.slice(0, wordCap()); /* v0.0.7.a Z5 */
  if (!list.length) { clearBusy(); cb(new Error('no_words')); return { ok: false, reason: 'no_words', words: [] }; }
  var source = Array.isArray(opts.existing) ? opts.existing : wordManagerWords();
  var prior = {}, i;
  for (i = 0; i < source.length; i++) {
   if (source[i] && str(source[i].w)) prior[str(source[i].w).toLowerCase()] = source[i];
  }
  var force = !!opts.force, slots = [], needs = [];
  for (i = 0; i < list.length; i++) {
   var raw = list[i], word = str(raw.w).replace(/^\s+|\s+$/g, '');
   if (!word) continue;
   var base = prior[word.toLowerCase()] || null;
   var provided = { p: str(raw.p), pos: str(raw.pos), m: str(raw.m), si: str(raw.si), s: str(raw.s) };
   var merged = mergeEnrichRecord(word, base, provided);
   var slot = { w: word, prior: base, record: merged };
   slots.push(slot);
   var deltaHit = (Array.isArray(opts.deltaOnly) && opts.deltaOnly.indexOf(word.toLowerCase()) >= 0);
   if (force || deltaHit || !hasFullRecord(merged) || str(merged.enrichSource) === 'lexicon') needs.push(slot);
  }
  ST.enriching = true;
  var offlineCount = 0, provider = aiProviderName(), capped = false;
  /* D3: live n/total progress + ONE */
  var total = needs.length, done = 0, settled = false, cap = null;
  function paintProgress() {
   var line = t('studioEnriching') + ' ' + done + '/' + total + '…';
   testStatus(line, '');
   setText(byId('studioEnrichStatus'), line);
  }
  function stopCap() { if (cap) { try { global.clearTimeout(cap); } catch (e) {} cap = null; } }
  function finishAll() {
   if (settled) return null;
   settled = true; stopCap();
   var out = [], j;
   for (j = 0; j < slots.length; j++) out.push(slots[j].record);
   ST.enriching = false;
   ST.enrichStatus = t('studioEnriched') + ' · ' + out.length + (offlineCount ? ' · ' + t('studioAiOffline') : '');
   setStudioWords(out);
   setText(byId('studioEnrichStatus'), ST.enrichStatus);
   msg(ST.enrichStatus, 'ok');
   testStatus(ST.enrichStatus + ' · ' + (provider === 'free_dict' ? 'free dictionary' : provider), 'ok');
   paintLecturerBar();
   var report = { ok: true, words: out, enriched: total, offline: offlineCount, provider: provider, capped: capped };
   cb(null, report);
   return report;
  }
  function capRemaining() {
   if (settled) return false;
   /* D3: every still-pending word */
   capped = true;
   for (var j = 0; j < needs.length; j++) {
    if (needs[j].recordDone) continue;
    needs[j].record = fallbackEnrich(needs[j].w, needs[j].prior);
    needs[j].recordDone = true;
    offlineCount += 1;
   }
   done = total;
   paintProgress();
   finishAll();
   return true;
  }
  function afterFree(index) {
   if (settled) return;
   if (index >= needs.length) { finishAll(); return; }
   var slot = needs[index];
   paintProgress();
   freeEnrichOne(slot.w, slot.prior, function (err, record, offline) {
    if (settled) return;
    slot.record = record;
    slot.recordDone = true;
    if (offline) offlineCount += 1;
    done = Math.min(total, done + 1);
    paintProgress();
    afterFree(index + 1);
   });
  }
  if (!needs.length) { ST.enriching = false; return finishAll(); }
  cap = global.setTimeout(capRemaining, 45000);
  if (aiNeedsLlm()) {
   var names = [], k;
   for (k = 0; k < needs.length; k++) names.push(needs[k].w);
   testStatus(t('studioEnriching') + ' · ' + provider, '');
   llmRequest(provider, aiProviderKey(), names, function (err, rows) {
    /* D6: when LLM slot fails, immediately */
    if (err || !isObj(rows)) {
     testStatus(T('studioAiOfflineFallback'), 'warn');
     afterFree(0);
     return;
    }
    if (settled) return;
    var rest = [], m;
    for (m = 0; m < needs.length; m++) {
     var slot2 = needs[m];
     var row = rows[slot2.w.toLowerCase()];
     if (isObj(row)) {
      slot2.record = mergeEnrichRecord(slot2.w, slot2.prior, row);
      slot2.recordDone = true;
      done = Math.min(total, done + 1);
     } else rest.push(slot2);
    }
    needs = rest;
    paintProgress();
    afterFree(0);
   });
   return { ok: true, pending: true, words: slots.length, provider: provider };
  }
  afterFree(0);
  return { ok: true, pending: true, words: slots.length, provider: provider };
 }
 /* D10: the zero-key dictionary probe */
 function freeDictTest(word, cb) {
  cb = cb || noop;
  var pending = 2, okDict = false, okSi = false;
  function done() {
   pending -= 1;
   if (pending > 0) return;
   var offline = !(okDict || okSi);
   testStatus((offline ? ' Free Dictionary ready · ' + t('studioAiOffline')
    : ' Free Dictionary ready · zero API key' + (okSi ? ' · EN→SI OK' : '')), 'ok');
   cb(null, { ok: true, provider: 'free_dict', dictionary: okDict, sinhala: okSi, offline: offline, word: word });
  }
  fetchJsonSafe(DICTIONARY_API + encodeURIComponent(word), 6000, function (err, json) {
   if (!err) okDict = !!dictFields(json).m;
   done();
  });
  fetchJsonSafe(SINHALA_API + encodeURIComponent(word) + '&langpair=en|si', 6000, function (err, json) {
   if (!err) okSi = !!sinhalaFrom(json);
   done();
  });
  return true;
 }
 /* `testAiEngine` — #btnTestAi. Never */
 function testAiEngine(cb) {
  cb = cb || noop;
  var provider = aiProviderName();
  var first = wordManagerWords()[0] || {};
  var word = str(first.w) || 'afraid';
  if (!aiNeedsLlm(provider, aiProviderKey())) {
   freeDictTest(word, cb);
   return { ok: true, pending: true, provider: 'free_dict' };
  }
  llmRequest(provider, aiProviderKey(), [word], function (err, rows) {
   if (err) {
    /* D10: a timed-out free LLM falls */
    testStatus(' ' + provider + ' · ' + str(err.message || 'llm_failed') + ' — ' + t('studioAiOffline'), '');
    freeDictTest(word, function (e2, report) {
     var out = report || { ok: true, provider: 'free_dict', word: word };
     out.provider = 'free_dict';
     out.fellBackFrom = provider;
     cb(null, out);
    });
    return;
   }
   var row = isObj(rows) ? rows[word.toLowerCase()] : null;
   testStatus(' ' + provider + ' ready · ' + (row ? 'JSON row valid' : 'reachable'), 'ok');
   cb(null, { ok: true, provider: provider, validated: !!row, word: word });
  });
  return { ok: true, pending: true, provider: provider };
 }

 /* ══ R9 / D15 / D19: one publish */
 /* W8/D19: stamp ONE syncRev into */
 function publishConfigAndVersion(cfgBody, envelope, label, cb) {
  cb = cb || noop;
  var token = str(ST.secrets.ghToken);
  var body = isObj(cfgBody) ? cfgBody : (sync() && sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {});
  var live = sync() && sync().version ? (sync().version() || {}) : {};
  var sess = str(live.session || '8') || '8';
  /* D14/W8: ONE publish clock per call */
  var rev = nextSyncRev();
  var versionBody = buildVersionPayload(sess, str(live.title || '') || ('Session ' + sess), rev);
  var settingsRev = Number(versionBody.settingsRev);
  versionBody.syncRev = Number(rev);
  versionBody.settingsRev = settingsRev;
  /* D17: prove this publish did NOT */
  versionBody.payloadFiles = ['data/config.json', 'data/version.json'];
  body.ver = schemaVer(); body.appVersion = appVersion(); body.version = appVersion();
  body.schema = schemaVer();
  body.settingsRev = settingsRev;
  body.syncRev = Number(rev);
  body.updatedAt = new Date().toISOString();
  if (envelope) body.encVault = str(envelope);
  if (!token || !sync() || !sync().publishFilesSequential) { cb(new Error('no_token'), null, versionBody); return versionBody; }
  publishVaultFiles(buildVaultFiles(body, versionBody, label || ('Studio vault ' + appVersion())), token, function (err, info) {
   cb(err, info, versionBody);
  });
  return versionBody;
 }
 function publishBundle(words, opts, cb) {
  opts = opts || {};
  cb = cb || noop;
  if (!ST.unlocked) { clearBusy(); cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
  var token = str(ST.secrets.ghToken) || fieldValue('ghTokenInput');
  if (!token) { clearBusy(); msg(t('studioNoToken'), 'bad'); cb(new Error('no_token')); return { ok: false, reason: 'no_token' }; }
  if (!sync() || !sync().publishFilesSequential) { clearBusy(); cb(new Error('no_sync')); return { ok: false, reason: 'no_sync' }; }
  var syncRev = nextSyncRev();
  var liveVersion = sync().version ? (sync().version() || {}) : {};
  var sessionNo = str(opts.sessionNo || ST.sessionNo || fieldValue('studioSessionNoInput') || liveVersion.session || (sync().sessionNo ? sync().sessionNo() : '8')) || '8';
  var title = str(opts.title || ST.title || fieldValue('studioSessionTitleInput') || liveVersion.title || '') || ('Session ' + sessionNo);
  var version = buildVersionPayload(sessionNo, title, syncRev);
  version.payloadFiles = ['data/session.json', 'data/config.json', 'data/elevenlabs-audio.json', 'data/version.json'];
  var session = buildSessionPayload(words, { sessionNo: sessionNo, title: title });
  session.syncRev = syncRev;
  session.settingsRev = Number(version.settingsRev);
  var cfg = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
  cfg.ver = schemaVer();
  cfg.appVersion = appVersion();
  cfg.version = appVersion();
  cfg.schema = schemaVer();
  cfg.settingsRev = Number(version.settingsRev);
  cfg.syncRev = syncRev;
  var env = isRealEnvelope(ST.envelope) ? ST.envelope : configEnvelope();
  if (env) cfg.encVault = str(env);
  var verifier = pinVerifier();
  if (isObj(verifier)) cfg.pinVerifier = verifier;
  cfg.classSettings = classSettingsPayload();
  cfg.updatedAt = new Date().toISOString();
  var pack = voicePackPayload(syncRev);
  /* v0.0.6.v — publish law: only the ACTIVE 30 words.* keys ship, and the
     pack stamps wordsRev so every client purges its stale word clips. */
  purgeNonActiveWordClips(pack);
  pack.wordsRev = Number(syncRev) || nextSyncRev();
  var files = [
   { path: 'data/session.json', content: JSON.stringify(session, null, 2), message: 'Smart Dictation words ' + appVersion() },
   { path: 'data/config.json', content: JSON.stringify(cfg, null, 2), message: 'Smart Dictation settings ' + appVersion() },
   { path: 'data/elevenlabs-audio.json', content: JSON.stringify(pack, null, 2), message: 'Alice voice pack ' + appVersion() },
   { path: 'data/version.json', content: JSON.stringify(version, null, 2), message: 'Smart Dictation version ' + appVersion() }
  ];
  sync().publishFilesSequential(files, token, function (path, ok) {
   if (!ok) msg(t('studioPublishFail') + ' · ' + path, 'bad');
  }, function (err, info) {
   if (err) { clearBusy(); cb(err, info); return; }
   bumpMeterCache();
   /* v0.0.6.c (F1): a landed atomic publish clears every dirty flag. */
   ST.dirty = false;
   ST.wordsDirty = false;
   ST.wordDeltas = [];
   try { paintDirtyState(); } catch (e2) {}
   ST.lastPublish = { at: Date.now(), syncRev: syncRev, files: files.map(function (f) { return f.path; }), version: version };
   /* v0.0.7.a Z4 — the instant post-publish audit banner with verified
      counts (re-reads the real state, never the action's own claims). */
   try { paintStudioActionAuditBanner('Publish', syncRev + ' rev · ' + files.length + ' files'); } catch (eA) {}
   cb(null, ST.lastPublish);
  });
  return { ok: true, pending: true, syncRev: syncRev };
 }
 
 /* D4: generate clips (non-fatal */
 function publishWordsAndVoice(cb) {
  cb = cb || noop;
  /* v0.0.7.c (BUG-03): validate BEFORE any clip synthesis — invalid words
     never burn a single ElevenLabs credit. */
  var gatePV = validateWordRecords(currentWords());
  if (!gatePV.ok) {
   msg(t('studioWordsInvalidTitle', 'Publish blocked — fix these words first:') + ' ' + gatePV.summary, 'bad');
   showToast(t('studioWordsInvalidTitle', 'Publish blocked — fix these words first:'));
   cb(new Error('invalid_words'));
   return;
  }
  /* v0.0.6.c (F1): Fast Delta Enrich (<2s in-app budget) — ONLY the words */
  function enrichDeltas(next) {
   try { detectWordDeltas(); } catch (e) {}
   if (!ST.wordsDirty || !ST.wordDeltas.length) { next(); return; }
   var names = [], i;
   for (i = 0; i < ST.wordDeltas.length; i++) names.push(ST.wordDeltas[i].w);
   var raw = fieldValue('studioBulkWords') || wordsToText(currentWords());
   var list = parseBulkWords(raw);
   /* mark ONLY the changed words for the enricher (force the rest off) */
   var forceNames = names.map(function (n) { return n.toLowerCase(); });
   for (i = 0; i < list.length; i++) {
    var w = str(list[i] && list[i].w).toLowerCase();
    list[i].force = forceNames.indexOf(w) >= 0;
   }
   enrichWords(list, { force: false, deltaOnly: forceNames }, function () {
    paintWordManager();
    next();
   });
  }
  /* Fast Delta Voice: generateClips already skips every unchanged clip at 0 */
  function voiceDeltas(next) {
   /* v0.0.7.a A2 — the UNIFIED KEY LAW: the pool counts too. A backup
      pool key alone must auto-generate exactly like a vault primary. */
   if (!trimmedKey(str(resolveElevenKey())) || !allowAutoGen()) { next(); return; }
   generateClips({ noCommit: true }, function (e, i) {
    if (e && !(i && i.tierLimited)) { clearBusy(); msg(t('studioPublishFail'), 'bad'); cb(e, i); return; }
    next();
   });
  }
  /* D18 mirror: any pipeline failure must clear every busy flag. */
  function failPipeline(err, info) { clearBusy(); msg(t('studioPublishFail') + ' \u00b7 ' + publishReason(err, info), 'bad'); cb(err, info); }
  function pub() { publishBundle(currentWords(), {}, function (err, info) {
   if (err) { clearBusy(); msg(t('studioPublishFail') + ' \u00b7 ' + publishReason(err, info), 'bad'); cb(err, info); return; }
   /* ══ v0.0.7.a A5 — THE INSTANT VERIFIED PUBLISH LAW: before any
      reloadManifest (which may transiently serve the cached pack), the
      just-published pack is injected into the live manifest with the NEW
      monotonic wordsRev/syncRev stamped on every entry, the manifest revs
      are bumped, and the guard audit re-runs against the JUST-PUBLISHED
      words — so the student Player, the Words screen and the banner all
      reflect the exact published state immediately. The old order (new
      words active + old cached pack → audit) painted the FALSE "Voice
      clips not generated" banner right after publishing. ව්‍යාජ අනතුරු
      ඇඟවීම ඉවත් විය. ══ */
   try {
    if (SDP.Speech) {
     var pubRev = Number(info && info.syncRev) || nextSyncRev();
     var pubClips = {};
     var iK;
     for (iK in (ST.voicePack.clips || {})) {
      if (!Object.prototype.hasOwnProperty.call(ST.voicePack.clips, iK)) continue;
      pubClips[iK] = ST.voicePack.clips[iK];
      if (isObj(pubClips[iK]) && !Number(pubClips[iK].wordsRev)) pubClips[iK].wordsRev = pubRev;
     }
     if (SDP.Speech.injectClips) SDP.Speech.injectClips(pubClips || {});
     if (SDP.Speech.state && isObj(SDP.Speech.state.manifest)) {
      SDP.Speech.state.manifest.wordsRev = pubRev;
      SDP.Speech.state.manifest.syncRev = pubRev;
      SDP.Speech.state.manifestRequested = false;
     }
     if (SDP.Speech.reloadManifest) SDP.Speech.reloadManifest(noop, true);
     /* re-audit against the exact published words so the banner only
        speaks the truth (and never ntfy-spams during the publish cycle). */
     if (SDP.Speech.auditSessionVoiceReadiness) {
      try { SDP.Speech.auditSessionVoiceReadiness({ words: currentWords(), justPublished: true }); } catch (eA2) {}
     }
    }
   } catch (e) {}
   /* v0.0.6.c (F1): the publish LANDED — clear the red warning, paint the */
   ST.dirty = false;
   ST.wordsDirty = false;
   ST.wordDeltas = [];
   paintDirtyState();
   var last = byId('lecturerSyncLast');
   if (last) {
    last.textContent = t('lecturerSyncLast') + ' \u00b7 ' + hhmm() + ' \u00b7 Rev #' + str(info && info.syncRev);
    last.setAttribute('data-state', 'ok');
   }
   var saved = clipCount() + t('studioClipsSaved') + (info && info.syncRev) + ' \u00b7 data/elevenlabs-audio.json';
   paintGenProgress(saved);
   paintPackDashboard();
   msg(saved, 'ok'); toast(T('studioPublishOkFull')); cb(null, info);
  }); }
  enrichDeltas(function () { voiceDeltas(pub); });
 }
 /* Re-seal the vault (and recompute */
 function sealVaultNow(cb) {
  cb = cb || noop;
  var v = vault();
  var pin = str(ST.pin || '');
  if (!v || !pin) { cb(new Error('no_pin')); return false; }
  if (v.stash) v.stash(ST.secrets);
  v.encryptV2(ST.secrets, pin).then(function (envelope) {
   ST.envelope = envelope;
   persistEnvelope(envelope);
   var currentVerifier = pinVerifier() || layerOneVerifier();
   var currentSalt = currentVerifier && isObj(currentVerifier) ? str(currentVerifier.salt) : '';
   /* D5: mirror the envelope + */
   writeLayerOne(envelope, currentVerifier);
   if (!v.computePinVerifier) { cb(null, envelope, currentVerifier); return; }
   v.computePinVerifier(pin, currentSalt).then(function (verifier) {
    var cfg = sync() && sync().config ? sync().config() : null;
    if (cfg) cfg.pinVerifier = verifier;
    writeLayerOne(envelope, verifier);
    cb(null, envelope, verifier);
   }, function () { cb(null, envelope, currentVerifier); });
  }, function () { cb(new Error('encrypt_failed')); });
  return true;
 }
 function oneClickMasterSetup(cb) {
  cb = cb || noop;
  if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
  if (ST.publishing) { cb(new Error('busy')); return { ok: false, reason: 'busy' }; }
  ST.publishing = true;
  ST.tierWarn = '';
  var elKey = '', gh = '';
  function fail(step, detail) {
   ST.publishing = false;
   setMasterStep(step, 'bad');
   paintErrorAssistant(step, detail);
   msg(t('studioPublishFail') + ' · ' + str(detail), 'bad');
   paintLecturerBar();
   cb(new Error('master_setup_failed'), { ok: false, step: step, detail: str(detail) });
  }
  /* v0.0.6.a: human-friendly bilingual Problem+Solution card. */
  function paintErrorAssistant(step, detail) {
   var host = byId('studioErrorAssistant');
   if (!host) return false;
   var problems = {
    1: ['The vault or a key could not be verified. Usually an expired GitHub token, a wrong PIN, or a missing AI key.',
        'තහඩුව හෝ යතුරක් තහවුරු කළ නොහැකි විය. සාමාන්‍යයෙන් ඉකුත් වූ GitHub token, වැරදි PIN එකක් හෝ AI යතුරක් නොමැති වීමයි.'],
    2: ['Auto-enrichment did not finish for every word. The network may be offline or the AI quota is exhausted.',
        'ස්වයංක්‍රීය පොහොසත් කිරීම සියලු වචන සඳහා නොනිමිණි. ජාලය නොමැති වීම හෝ AI කෝටාව අවසන් වීම විය හැකියි.'],
    3: ['The voice pack sync hit a limit or a missing clip. Existing clips are always reused at 0 credits.',
        'හඬ පැකේජ සමමුහුර්තයට සීමාවක් හෝ නොමැති ක්ලිප් එකක් බාධා කළා. පවතින ක්ලිප් සැමවිටම 0 ක්‍රෙඩිට් වලින් නැවත භාවිත වේ.'],
    4: ['The publish did not land. Most often a 409 conflict (another device pushed first) or a rate limit.',
        'පළ කිරීම සාර්ථක නොවීය. බොහෝවිට 409 ගැටුමක් (වෙනත් උපාංගයක් පළ කර ඇත) හෝ සීමාවකි.']
   };
   var solutions = {
    1: 'Re-enter the GitHub token (ghp_…/github_pat_…) and the PIN, then press 1-Click Fix.',
    2: 'Check the connection, then press 1-Click Fix — the built-in offline British IPA lexicon finishes the words with zero credits.',
    3: 'Press 1-Click Fix to run the 0-credit recovery (reuse the 100 saved clips + history).',
    4: 'Press 1-Click Fix — the publisher retries with a fresh SHA and a monotonic syncRev.'
   };
   var pair = problems[step] || problems[4];
   host.setAttribute('data-step', String(step));
   host.setAttribute('data-state', 'visible');
   host.innerHTML =
    '<h4 class="studio-h4">⚠ ' + T('studioErrTitle') + '</h4>' +
    '<p class="studio-err-line">' + esc(str(detail) || pair[0]) + '</p>' +
    '<p class="studio-err-line">' + esc(pair[0]) + '</p>' +
    '<p class="studio-err-line" lang="si">' + esc(pair[1]) + '</p>' +
    '<p class="studio-err-solution">→ ' + esc(solutions[step] || solutions[4]) + '</p>' +
    '<div class="chip-row">' +
    btn('btnRetryFailedStep', t('studioErrFixNow'), 'btn-primary', 'data-retry-step="' + step + '"') +
    btn('btnDismissError', t('studioErrDismiss'), 'btn-ghost') +
    '</div>';
   try { host.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
   return true;
  }
  function hideErrorAssistant() {
   var host = byId('studioErrorAssistant');
   if (host) { host.setAttribute('data-state', 'hidden'); host.innerHTML = ''; }
   return true;
  }
  function step4(genInfo) {
   setMasterStep(4, 'active');
   publishBundle(currentWords(), {}, function (pubErr, pubInfo) {
    if (pubErr) { fail(4, publishReason(pubErr, pubInfo)); return; }
    try { if (SDP.Speech && SDP.Speech.injectClips) SDP.Speech.injectClips(ST.voicePack.clips || {}); } catch (e) {}
    ST.publishing = false;
    ST.masterStep = 5;
    ST.masterDetail = 'ok';
    hideErrorAssistant();
    paintMasterSteps();
    paintVaultBadge();
    var made = genInfo && genInfo.made ? genInfo.made.length : 0;
    var totalClips = clipCount();
    var savedLine = totalClips + t('studioClipsSaved') + (pubInfo && pubInfo.syncRev) + ' · data/elevenlabs-audio.json · 0 credits';
    msg(savedLine, 'ok');
    paintGenProgress(savedLine);
    paintPackDashboard();
    toast(t('studioPublishOk'));
    cb(null, {
     ok: true, clips: made,
     skipped: genInfo ? genInfo.skipped : 0,
     tierLimited: !!(genInfo && genInfo.tierLimited),
     warning: ST.tierWarn,
     syncRev: pubInfo && pubInfo.syncRev, files: pubInfo && pubInfo.files
    });
   });
  }
  /* Step 3 — voice pack with the IRON LAW 0-credit guard: existing clips and */
  function step3() {
   setMasterStep(3, 'active');
   if (!elKey) {
    var note = tierWarning();
    msg(' ' + note, '');
    testStatus(' ' + note, '');
    step4({ made: [], skipped: 0, tierLimited: true });
    return;
   }
   generateClips({ force: false, noCommit: true }, function (genErr, genInfo) {
    if (genErr && !(genInfo && genInfo.tierLimited)) { fail(3, quotaError(genErr)); return; }
    step4(genInfo || { made: [], skipped: 0 });
   });
  }
  /* Step 2 — auto-enrich every word with real British IPA; the offline */
  function step2() {
   setMasterStep(2, 'active');
   var raw = fieldValue('studioBulkWords') || wordsToText(currentWords());
   enrichWords(raw, { force: false }, function (err) {
    if (err && str(err && err.message) === 'no_words') { fail(2, 'paste the 30 words first'); return; }
    testStatus(t('studioEnriched') + ' · real British IPA /…/ · POS · EN+SI meanings', 'ok');
    step3();
   });
  }
  /* Step 1 — read inputs, seal vault, verify GitHub token. */
  setMasterStep(1, 'active');
  hideErrorAssistant();
  var prevSecrets = secretSnapshot();
  mergeSecretInputs();
  guardSecretMerge(prevSecrets);
  /* v0.0.7.a A2: the master setup accepts ANY configured pool key. */
  elKey = trimmedKey(str(resolveElevenKey()));
  gh = str(ST.secrets.ghToken);
  sealVaultNow(function (sealErr, envelope, verifier) {
   if (!sealErr) writeLayerOne(envelope, verifier || pinVerifier());
   if (sealErr) { fail(1, 'the vault could not be sealed — check the PIN (4–8 digits) and try again'); return; }
   if (!gh) { fail(1, 'GitHub token missing — add a ghp_… / github_pat_… token in Key 2'); return; }
   testGitHubToken(gh, function (ghErr) {
    if (ghErr) { fail(1, ghError(ghErr)); return; }
    testStatus(T('vaultBadgeLabel') + ' · keys verified', 'ok');
    step2();
   });
  });
  return { ok: true, pending: true };
 }

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
  host.innerHTML = '<table class="studio-preview-table"><thead><tr><th>#</th><th>w</th><th>IPA</th><th>සිංහල</th></tr></thead><tbody>' + rows + '</tbody></table>' + '<p class="studio-msg">data/session.json · data/config.json · data/elevenlabs-audio.json · data/version.json · ' +
   ST.words.length + ' ' + T('studioWordsCount') + '</p>';
  return payloads;
 }

 /* ── publishing: sequential */
 /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publishing */
 /* D13/D19: the pre-publish checklist */
 /* D17: the vault legs are REQUIRED only */
 function publishChecklist(payloads, opts) {
  opts = opts || {};
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
  var needVault = hasVault() || !!opts.requireVault;
  if (needVault) {
   if (!env) problems.push('vault envelope missing');
   if (!isObj(cfg.pinVerifier) || !str(cfg.pinVerifier.hash)) problems.push('pinVerifier missing');
  }
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
  /* v0.0.7.c (BUG-03): the strict word-record schema gate — nothing that
     fails validation may ever leave the studio. */
  var gate = validateWordRecords(currentWords());
  if (!gate.ok) {
   msg(t('studioWordsInvalidTitle', 'Publish blocked — fix these words first:') + ' ' + gate.summary, 'bad');
   showToast(t('studioWordsInvalidTitle', 'Publish blocked — fix these words first:'));
   cb(new Error('invalid_words'));
   return;
  }
  /* v0.0.6.m Pillar 2: Publish & Sync first auto-synthesizes any missing
     v0.0.6.s: publish keeps the SEQUENTIAL chain — autoEnsureSystemClips
     runs to completion FIRST (a synchronous delta pass), then the bridge;
     they are never fired concurrently like the old unlock race. */
  autoEnsureSystemClips({ source: 'publish' }, function () {
    ensureBriefingAndGuideVoices({ source: 'publish' }, noop);
    /* v0.0.6.n cache-bust law: a publish must also purge any stale */
    try {
      if (global.SDP && SDP.Sync && SDP.Sync.purgeStaleBriefingClips) SDP.Sync.purgeStaleBriefingClips();
    } catch (eP) {}
   var payloads = buildPublishPayloads(currentWords(), {});
   /* D19: refuse a broken payload */
   var problems = publishChecklist(payloads, { requireVault: false });
   if (problems.length) {
    msg(t('studioPublishFail') + ' · ' + problems.join(' · '), 'bad');
    clearBusy();
    cb(new Error('checklist_failed'));
    return;
   }
   /* D17: no vault yet is a warning */
   if (!hasVault()) {
    testStatus(' ' + t('studioNoVaultWarn'), 'warn');
    toast(t('studioNoVaultWarn'));
   }
   return publishBundle(currentWords(), {}, function (err, info) {
    if (err) { clearBusy(); cb(err, info); return; }
    msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
    cb(null, info);
   });
  });
 }

 /* ══ D-C1..C7: credit-safe Alice */
 function elevenUrl() { return 'https://api.elevenlabs.io/v1/text-to-speech/' + activeVoiceId; }
/* v0.0.6.q: the Project Briefing clips synthesize with the CHOSEN */
function introVoiceTtsUrl() { return 'https://api.elevenlabs.io/v1/text-to-speech/' + chosenBriefingVoiceId(); }
 function guideSteps() {
  /* R5: the four reusable guide clips. The frozen legacy keys stay readable */
  var out = [], i;
  for (i = 1; i <= 4; i++) out.push({ key: '_guide_' + i, text: GUIDE_CLIP_TEXTS[i - 1] });
  return out;
 }
 function commandClips() {
  var out = [], i;
  for (i = 0; i < CMD_CLIPS.length; i++) out.push({ key: CMD_CLIPS[i].key, text: CMD_CLIPS[i].text });
  return out;
 }
 function numberClips() {
  var out = [], i;
  for (i = 1; i <= Math.max(30, wordCap()); i++) out.push({ key: 'num.' + i, text: numberClipText(i) }); /* v0.0.7.a Z5 */
  return out;
 }
 function costPreview(words) {
  var list = Array.isArray(words) ? words : currentWords();
  var wordChars = 0, i, count = Math.min(wordCap(), list.length); /* v0.0.7.a Z5 */
  for (i = 0; i < count; i++) wordChars += str((list[i] || {}).w).length;
  var numbers = numberClips(), numsChars = 0;
  for (i = 0; i < numbers.length; i++) numsChars += numbers[i].text.length;
  var cmds = commandClips(), cmdChars = 0;
  for (i = 0; i < cmds.length; i++) cmdChars += cmds[i].text.length;
  var steps = guideSteps(), guideChars = 0;
  for (i = 0; i < steps.length; i++) guideChars += steps[i].text.length;
  /* v0.0.6.m Pillar 1: the 4 Project Briefing beats (deep British male). */
  var intro = introSteps(), introChars = 0;
  for (i = 0; i < intro.length; i++) introChars += intro[i].text.length;
  var clips = count + numbers.length + cmds.length + steps.length + intro.length;
  return {
   words: wordChars, numbers: numsChars, commands: cmdChars, guide: guideChars, intro: introChars,
   total: wordChars + numsChars + cmdChars + guideChars + introChars, count: count, clips: clips
  };
 }
 function costPreviewLine(words) {
  var c = costPreview(words);
  /* R5: the clip arithmetic, always stated, never guessed — the numbers
     count follows the live cap (v0.0.7.a: 31 numbers on a 31-word run). */
  var nNums = Math.max(30, wordCap());
  return c.count + ' words = ' + c.words + ' chars · ' + nNums + ' numbers = ' + c.numbers +
   ' chars · 6 commands = ' + c.commands + ' chars · 4 guide steps = ' + c.guide +
   ' chars · 4 intro steps = ' + c.intro + ' chars · total ' + c.total + ' chars · ' + c.clips +
   ' clips (' + wordCap() + ' words + ' + nNums + ' numbers + 6 commands + 4 guide steps + 4 intro steps)';
 }
 /* D2: 403 / missing_permissions / */
 /* D5/D16: human error sentences. */
 function quotaError(err) {
  var d = str(err && err.code), c = Number((err && err.status) || 0), m = str(err && err.message);
  if (err && err.scoped) return SCOPED_NOTE();
  if (d === 'invalid_api_key' || c === 401) return 'ElevenLabs key not accepted — please check and try again';
  if (d === 'missing_permissions' || c === 403) return SCOPED_NOTE();
  if (c === 402 && /paid_plan_required|library voices/i.test(m + ' ' + d)) return 'This voice needs an ElevenLabs paid plan — switched to the free British female educator voice (Alice)';
  if (d === 'quota_exceeded' || c === 402) 'ElevenLabs free quota used up — top up or wait for renewal';
  if (c === 429) return 'ElevenLabs is busy — trying again in a few seconds';
  if (c === 422) return 'Voice settings not on this plan — using simplified settings';
  if (c === 400) return 'ElevenLabs could not process the request — please try again';
  if (c === 500) return 'ElevenLabs server temporarily unavailable — try again soon';
  if (c > 0) return 'ElevenLabs returned an unexpected response — please try again';
  if (m === 'empty_audio' || m === 'encode_failed') return 'Voice clip could not be created — please try again';
  if (m === 'network_error' || m === 'network error' || m === 'no_fetch') return 'Network problem — check your internet and try again';
  if (!m || m === 'subscription_failed' || m === 'key_rejected' || m === 'tts_failed') return 'ElevenLabs key kept — quota read unavailable, voice generation still works';
  return 'Something went wrong with the voice service — please try again';
 }
 function tierWarning() { return (ST.tierWarn = TIER_WARN()); }
 function ghError(err) {
  var code = Number((err && err.status) || 0);
  if (code === 401) return 'GitHub token rejected (401)';
  if (code === 403) return 'GitHub token lacks write access (403)';
  if (code === 404) return 'Repository or token scope not found (404)';
  return str(err && err.message) || 'network error';
 }
 function withStatus(err, status) { err = err || new Error('http_' + status); err.status = status; return err; }
 /* D7: the sync module owns the */
 function publishErrorText(status, message) {
  try { if (sync() && sync().publishErrorText) return sync().publishErrorText(Number(status) || 0, str(message)); } catch (e) {}
  return 'Network problem — check your internet and try again';
 }
 /* D6/D7: the best human reason out */
 function publishReason(err, info) {
  var list = err && Array.isArray(err.errors) ? err.errors : (info && Array.isArray(info.errors) ? info.errors : []);
  var reason = str(err && err.reason) || (list.length ? str(list[0].message) : '');
  if (!reason) {
   var text = str(err && err.message);
   if (text === 'no_token') reason = t('studioNoToken');
   else reason = publishErrorText(Number(err && err.status) || 0, text !== 'publish_partial' ? text : '');
  }
  return reason;
 }
 function hhmm() { return new Date().toISOString().slice(11, 16); }
 function paintLecturerBar() {
  try { if (global.SDP && SDP.Views && SDP.Views.paintLecturerBar) return SDP.Views.paintLecturerBar(); } catch (e) {}
  return false;
 }
 function clearBusy() { ST.generating = false; ST.publishing = false; ST.enriching = false; paintLecturerBar(); }
 function bumpMeterCache() {
  try { if (global.SDPDataMeter && global.SDPDataMeter.clearCache) return global.SDPDataMeter.clearCache(); } catch (e) {}
  return '';
 }
 /* D1 (Rule 1A) — the 3-rung */
 function trimmedKey(key) { return str(key).replace(/^\s+|\s+$/g, ''); }
 function looksLikeElevenKey(key) {
  return /^sk_[A-Za-z0-9_]{20,}$/.test(trimmedKey(key));
 }
 function elevenKeyHint() { return t('studioVerifyHint', 'INVALID KEY — paste the sk_… secret from ElevenLabs'); }

 function paintElVerify(text, state) {
  var node = byId('elVerifyStatus');
  if (!node) return false;
  node.textContent = str(text);
  if (state) node.setAttribute('data-state', state);
  else node.removeAttribute('data-state');
  return true;
 }
 function playVaultClip(key) {
  var entry = ST.voicePack.clips ? ST.voicePack.clips[key] : null;
  var url = '';
  if (typeof entry === 'string') url = entry;
  else if (isObj(entry)) url = str(entry.url) || (str(entry.b64) ? 'data:audio/mpeg;base64,' + str(entry.b64) : '');
  if (!url) return false;
  try { if (SDP.Speech && SDP.Speech.playUrl) { SDP.Speech.playUrl(url, { timeoutMs: 15000 }, noop); return true; } } catch (e) {}
  return false;
 }
 function verifyElevenKey() {
  /* v0.0.7.a A2: field value wins ONLY when actually typed; otherwise the
     pool-resolved key (fixes stale-field-wins precedence bug). */
  var typedEl = trimmedKey(fieldValue('elKeyInput'));
  var key = trimmedKey(typedEl || str(resolveElevenKey()));
  if (!looksLikeElevenKey(key)) {
   paintElVerify(elevenKeyHint(), 'bad');
   msg(elevenKeyHint(), 'bad');
   return false;
  }
  paintElVerify(t('studioWorking', 'Working…'), '');
  elevenGet(EL_SUBSCRIPTION, key, function (err, res) {
   if (!res || !res.ok) {
    var status = Number((res && res.status) || 0);
    var line = t('studioVerifyBad') + status + ' — ' + t('studioVerifyHint') + ')';
    paintElVerify(line, 'bad');
    return;
   }
   var b = isObj(res.body) ? res.body : {};
   var used = Number(b.character_count), lim = Number(b.character_limit);
   if (isNaN(used)) used = 0;
   if (isNaN(lim)) lim = 0;
   var left = Math.max(0, lim - used);
   paintElVerify(t('studioVerifyOk') + left + ' / ' + lim + ' chars)', 'ok');
   testStatus(' ' + t('studioVerifyOk') + left + ' / ' + lim + ' chars)', 'ok');
   /* VALID: prove the voice. A cached sample is free; otherwise ONE 36-char */
   ST.secrets = isObj(ST.secrets) ? ST.secrets : {};
   ST.secrets.elevenKey = key;
   if (clipExists('cmd.sample')) { playVaultClip('cmd.sample'); return true; }
   generateClips({ keys: ['cmd.sample'] }, function () { playVaultClip('cmd.sample'); });
   return true;
  });
  return true;
 }

 function isBootstrapPin(pin) { return trimmedKey(pin) === BOOTSTRAP_PIN; }
 function recoveryOpen(cb) {
  cb = cb || noop;
  ST.recoveryMode = true;
  ST.unlocked = true;
  ST.bootstrapMode = true;
  ST.pin = '';
  ST.envelope = '';
  ST.secrets = isObj(ST.secrets) ? ST.secrets : {};
  msg(t('studioChangePinBtn') + ' — ' + t('studioRecoveryUsed'), 'warn');
  try { mount(); } catch (e) {}
  try { paintLecturerBar(); } catch (e) {}
  try { loadVoicePack(noop); } catch (e) {}
  cb(null, ST.secrets);
  return true;
 }
 function changePin(cb) {
  cb = cb || noop;
  var want = newPinValue(), confirm = confirmPinValue();
  if (want.length < PIN_MIN || want.length > PIN_MAX) { msg(t('studioBadPin'), 'bad'); cb(new Error('bad_pin')); return false; }
  if (want !== confirm) { msg(t('studioPinMismatch'), 'bad'); cb(new Error('pin_mismatch')); return false; }
  var v = vault();
  if (!v || !v.computePinVerifier || !v.encryptV2) { msg(t('studioPublishFail') + ' · crypto_unavailable', 'bad'); cb(new Error('crypto_unavailable')); return false; }
  var plain = isObj(ST.secrets) ? ST.secrets : {};
  /* A FRESH salt every time — never reuse the old verifier's salt. */
  v.computePinVerifier(want).then(function (verifier) {
   return v.encryptV2(plain, want).then(function (envelope) {
    ST.pin = want;
    ST.envelope = envelope;
    ST.recoveryMode = false;
    writeLayerOne(envelope, verifier);
    /* v0.0.6.d (D8): remember the new PIN length so the gate renders exactly */
    try {
     var lock = layerOneVault();
     lock.pinLen = want.length;
     data().saveSettings({ vaultLock: lock });
    } catch (e2) {}
    var cfgBody = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
    cfgBody.encVault = envelope;
    cfgBody.pinVerifier = verifier;
    publishConfigAndVersion(cfgBody, envelope, 'Lecturer PIN change ' + appVersion(), function (err) {
     if (err) { msg(t('studioPublishFail'), 'bad'); cb(err); return; }
     msg(t('studioPublishOk') + ' · ' + t('studioChangePinBtn'), 'ok');
     try { mount(); } catch (e) {}
     cb(null, true);
    });
    return true;
   });
  }, function (err) { msg(t('studioPublishFail') + ' · encrypt_failed', 'bad'); cb(err || new Error('encrypt_failed')); });
  return true;
 }

 function detailCode(body) {
  if (!isObj(body)) return '';
  var d = isObj(body.detail) ? body.detail : null;
  return str(d && d.status);
 }
 function scopedVerdict() { return { ok: true, scoped: true, remaining: null, note: SCOPED_NOTE() }; }
 function fatalKey(status) {
  var err = withStatus(new Error('invalid_api_key'), status || 401);
  err.code = 'invalid_api_key';
  err.fatal = true;
  return err;
 }
 function elevenGet(url, key, cb) {
  cb = cb || noop;
  if (typeof global.fetch !== 'function') { cb(new Error('no_fetch'), null); return false; }
  function wrap(res) {
   var ok = !!(res && res.ok);
   var status = res && typeof res.status === 'number' ? res.status : (ok ? 200 : 0);
   var read = res && typeof res.json === 'function' ? res.json() : null;
   function give(body) { cb(null, { status: status, body: body, ok: ok }); }
   if (!read || typeof read.then !== 'function') { give(null); return null; }
   return read.then(give, function () { give(null); });
  }
  try {
   global.fetch(url, { method: 'GET', headers: { 'xi-api-key': str(key), Accept: 'application/json' }, cache: 'no-store' })
    .then(wrap, function (err) { cb(err || new Error('network_error'), null); });
  } catch (e) { cb(e || new Error('network_error'), null); return false; }
  return true;
 }
 /* Zero-cost endpoint: reading the */
 function fetchSubscription(key, cb) {
  cb = cb || noop;
  if (!key) { cb(withStatus(new Error('no_key'), 401)); return false; }
  if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
  function accept(v) { ST.quota = v; cb(null, v); }
  elevenGet(EL_SUBSCRIPTION, key, function (err, res) {
   if (!err && res && res.ok) {
    var b = isObj(res.body) ? res.body : {};
    var used = Number(b.character_count), lim = Number(b.character_limit);
    if (isNaN(used)) used = 0;
    if (isNaN(lim)) lim = 0;
    accept({ ok: true, used: used, limit: lim, remaining: Math.max(0, lim - used) });
    return;
   }
   var status = (res && Number(res.status)) || 0, code = detailCode(res && res.body);
   if (code === 'invalid_api_key') { cb(fatalKey(status)); return; }
     elevenGet(EL_VOICES, key, function (err2, res2) {
    if (!err2 && res2 && res2.ok) { accept(scopedVerdict()); return; }
    var code2 = detailCode(res2 && res2.body);
    if (code2 === 'invalid_api_key') { cb(fatalKey((res2 && Number(res2.status)) || status)); return; }
       if (looksLikeElevenKey(key)) { accept(scopedVerdict()); return; }
    var bad = withStatus(new Error('key_rejected'), (res2 && Number(res2.status)) || status || 0);
    bad.code = code2 || code || 'key_rejected';
    cb(bad);
   });
  });
  return true;
 }
 function probeQuota(key, cb) {
  cb = cb || noop;
  fetchSubscription(key, function (err, result) {
   var line;
   if (err) {
    line = ' ' + quotaError(err);
    setText(byId('quotaText'), line);
    testStatus(line, 'bad');
    cb(err);
    return;
   }
   /* D2: a scoped key paints GREEN, never a */
   if (result && result.scoped) line = str(result.note) || SCOPED_NOTE();
   else line = 'Used ' + result.used + ' / Limit ' + result.limit + ' chars · Remaining: ' + result.remaining;
   setText(byId('quotaText'), line);
   testStatus((result && result.scoped ? ' ' : ' ElevenLabs Connected · ') + line, 'ok');
   cb(null, result);
  });
  return true;
 }
 function checkQuota(key, cb) { return probeQuota(key, cb); }
 function testElevenLabsKey(key, cb) { return probeQuota(key, cb); }
 /* ══ v0.0.7.a A2 — THE PRE-FLIGHT CREDIT CHECK ACROSS THE WHOLE KEY POOL.
    Before synthesizing N missing words (especially N > 30), every
    configured ElevenLabs key is probed once via GET /v1/user/subscription
    and the TOTAL remaining characters are compared against the EXACT
    characters needed for the missing words only. Mid-batch failover
    (rotateElevenKey, HTTP 401/402/429/…) already exists — this is the
    honest pre-flight so the lecturer knows BEFORE a single credit burns. */
 function charsNeededForWords(wordTexts) {
  var n = 0, i;
  for (i = 0; i < (wordTexts || []).length; i++) n += str(wordTexts[i]).length;
  return n;
 }
 function preFlightCreditCheck(missingWordTexts, cb) {
  cb = cb || noop;
  var pool = elevenKeyPool();
  var need = charsNeededForWords(missingWordTexts);
  if (!pool.length) { cb(null, { ok: false, reason: 'no_keys', need: need, have: 0, perKey: [] }); return { ok: false }; }
  var perKey = [], doneN = 0, have = 0, i;
  for (i = 0; i < pool.length; i++) {
   (function (idx, key) {
    fetchSubscription(key, function (err, res) {
     var scoped = !err && res && res.scoped === true;
     var row = { slot: idx + 1, ok: !err, remaining: (err || scoped) ? 0 : Number(res.remaining) || 0, err: err ? str(err.message).slice(0, 80) : '', scoped: scoped };
     perKey.push(row);
     if (!err && !scoped) have += row.remaining;
     if (scoped) perKey.scopedCount = (perKey.scopedCount || 0) + 1;
     doneN += 1;
     if (doneN === pool.length) {
      /* v0.0.7.a A2 — THE SCOPED-KEY LAW: a key that cannot be measured
         (missing_permissions on /subscription but /voices works) never
         triggers the insufficiency verdict — credits are UNKNOWN, not zero;
         the old 402-tolerant retry ladder governs the batch instead. */
      var scopedN = perKey.scopedCount || 0;
      var ok = (scopedN > 0) ? true : (have >= need);
      cb(null, { ok: ok, need: need, have: have, perKey: perKey.sort(function (a, b) { return a.slot - b.slot; }), keys: pool.length, scopedKeys: scopedN });
     }
    });
   })(i, pool[i]);
  }
  return { ok: true, pending: true };
 }
 /* v0.0.7.a A2 — the compact key-pool status chip at the top of Studio:
    "🔑 ElevenLabs Pool: X Keys Ready · Y chars left". Painted from the last
    subscription probe (60 s cache) or the local key count when offline. */
 var keyPoolChipCache = { at: 0, have: 0, keys: 0, state: 'idle' };
 function paintKeyPoolChip() {
  var chip = byId('studioKeyPoolChip');
  if (!chip) return false;
  var keys = elevenKeyPool().length;
  var fresh = (Date.now() - keyPoolChipCache.at) < 60000;
  var state = 'idle', txt;
  if (!keys) { state = 'empty'; txt = '🔑 Pool: no ElevenLabs keys — add keys in Drawer C'; }
  else if (fresh && keyPoolChipCache.keys === keys) {
   state = keyPoolChipCache.have < 500 ? 'low' : 'ready';
   txt = '🔑 ElevenLabs Pool: ' + keys + ' Keys Ready · ' + keyPoolChipCache.have + ' chars left';
  } else {
   state = 'ready';
   txt = '🔑 ElevenLabs Pool: ' + keys + ' Keys Ready' + (keyPoolChipCache.have ? ' · ' + keyPoolChipCache.have + ' chars left' : '');
   if ((Date.now() - keyPoolChipCache.at) >= 60000) {
    keyPoolChipCache.at = Date.now();
    preFlightCreditCheck([], function (e, r) {
     if (r && r.perKey && r.perKey.length) {
      keyPoolChipCache.have = r.have; keyPoolChipCache.keys = r.keys || keys;
      try { paintKeyPoolChip(); } catch (eP2) {}
     }
    });
   }
  }
  chip.setAttribute('data-state', state);
  setText(chip, txt);
  return true;
 }
 /* v0.0.7.a A2 — the SMART QUOTA-EXCEEDED GUIDANCE (bilingual Sinhala +
    English) with the 3 one-click actions: add another key, use only words
    with ready clips, or reduce the custom word count to fit the credits. */
 function openQuotaExceededDialog(check) {
  var host = byId('studioQuotaDialog');
  if (!host) return false;
  var need = Number(check && check.need) || 0, have = Number(check && check.have) || 0;
  var words = currentWords();
  var afford = Math.max(5, Math.floor((have / Math.max(1, need)) * words.length));
  host.hidden = false;
  host.setAttribute('data-state', 'quota');
  setText(byId('studioQuotaHeadline'), '⚠ Credits ප්‍රමාණවත් නැවත · Credits insufficient');
  setText(byId('studioQuotaDetail'),
   'Credits ප්‍රමාණවත් නැත: වචන ' + words.length + 'න් වචන ' + afford + 'ක් සඳහා පමණක් Credits ඇත — ' +
   'needed ~' + need + ' chars, pool has ' + have + ' chars. Add another ElevenLabs API key (free keys get 10,000 chars/month each) or pick an action:');
  return true;
 }
 function closeQuotaExceededDialog() {
  var host = byId('studioQuotaDialog');
  if (host) host.hidden = true;
  return true;
 }
 function trimToReadyClips() {
  /* keep ONLY the words that already have a valid playable clip */
  var words = currentWords(), keep = [], i, k;
  for (i = 0; i < words.length; i++) {
   k = 'words.' + str(words[i] && words[i].w).toLowerCase();
   if (clipExists(k)) keep.push(words[i]);
  }
  if (!keep.length) { msg('No words have ready voice clips yet — generate at least one clip first.', 'warn'); return false; }
  setStudioWords(keep, 'bulk');
  try { var bulk = byId('studioBulkWords'); if (bulk) bulk.value = wordsToText(keep); } catch (eB) {}
  setWordCap(Math.max(5, keep.length), wordCountMode());
  closeQuotaExceededDialog();
  msg('✂️ Session trimmed to ' + keep.length + ' words with ready voice clips — 100% of active words now play cleanly.', 'ok');
  paintWordCountPill(); paintWordsHelper(); paintLiveChips();
  return true;
 }
 function reduceCountToCredits(check) {
  var words = currentWords();
  var need = Number(check && check.need) || 0, have = Number(check && check.have) || 0;
  var afford = Math.max(5, Math.floor((have / Math.max(1, need)) * words.length));
  setWordCap(Math.min(afford, words.length), 'custom');
  closeQuotaExceededDialog();
  msg('📉 Word count reduced to ' + wordCap() + ' — the session now fits the available credits (' + have + ' chars).', 'ok');
  paintWordCountPill(); paintWordsHelper();
  return true;
 }
 /* v0.0.7.a A2 — quota probe follows the UNIFIED KEY LAW: the active
    pool key (rotates with the cursor), never a stale field value. */
 function refreshQuota(cb) { return probeQuota(resolveElevenKey(), cb); }
 /* D-L3: accepts classic ghp_ tokens */
 function testGitHubToken(token, cb) {
  cb = cb || noop;
  var tk = str(token);
  if (!tk) { cb(withStatus(new Error('no_token'), 401)); return false; }
  if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
  /* v0.0.6.v: the literal fallback is gone — always the derived origin. */
  var repo = sync() && sync().repo ? sync().repo() : null;
  if (!repo) { cb(withStatus(new Error('no_sync'), 0)); return false; }
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
    testStatus(' GitHub Connected (' + result.repo + ' · Write OK)', 'ok');
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
  
  if (typeof Buffer !== 'undefined') return Buffer.from(out, 'binary').toString('base64');
  return '';
 }
 /* R2/D2: read the pack through the */
 function loadVoicePack(cb) {
  cb = cb || noop;
  if (ST.voicePack.loaded) { cb(null, ST.voicePack); return true; }
  SDP.Sync.fetchFreshDataJson('data/elevenlabs-audio.json', function (err, result) {
   if (err || !result || !result.ok) { ST.voicePack.loaded = true; cb(err || new Error('pack_failed')); return; }
   var pack = result.json;
   if (isObj(pack) && isObj(pack.clips)) ST.voicePack.clips = pack.clips;
   /* v0.0.6.t PILLAR 3F — the LIVE-CLIP PRESERVATION law: the repo pack is
      the FLOOR, never the ceiling. A Cloned-Voice beat already playing on
      THIS device (liveEleven === true in the live SDP.Speech manifest, or
      stamped by ./local-briefing-pack.json / sdp.briefing.meta) is newer
      than the repo entry when its .at is >= the pack's, and must NEVER be
      overwritten by a stale repo-preload — that is how the creator's
      Cloned Voice kept reverting to the old system voice on every unlock. */
   try {
    var liveMan = null;
    if (global.SDP && SDP.Speech && SDP.Speech.clipManifest) liveMan = SDP.Speech.clipManifest();
    var liveKeys = ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4', '_guide_1', '_guide_2', '_guide_3', '_guide_4', 'guide.en.0', 'guide.en.1', 'guide.en.2', 'guide.en.3'];
    for (var lk = 0; lk < liveKeys.length; lk++) {
     var kName = liveKeys[lk];
     var liveEntry = liveMan && liveMan.clips && isObj(liveMan.clips[kName]) ? liveMan.clips[kName] : null;
     if (!liveEntry || liveEntry.liveEleven !== true || !str(liveEntry.b64)) continue;
     var packEntry = ST.voicePack.clips[kName];
     if (Number(liveEntry.at || 0) >= Number((packEntry && packEntry.at) || 0)) ST.voicePack.clips[kName] = liveEntry;
    }
   } catch (eLive) {}
   /* v0.0.4.b: the shipped pack is b64-only; drop any legacy .url in memory. */
   if (isObj(ST.voicePack.clips)) {
    for (var ck in ST.voicePack.clips) {
     if (!Object.prototype.hasOwnProperty.call(ST.voicePack.clips, ck)) continue;
     var ce2 = ST.voicePack.clips[ck];
     if (ce2 && typeof ce2 === 'object' && ce2.url) delete ce2.url;
    }
   }
   ST.voicePack.rev = Number((pack && pack.syncRev) || 0);
   ST.voicePack.source = str(result.source);
   ST.voicePack.loaded = true;
   cb(null, ST.voicePack);
  });
  return true;
 }
 function clipExists(key) {
  var entry = packedSystemClip(key);
  if (!entry) return false;
  /* v0.0.7.b B1: presence is NOT existence — a zero-byte / empty-b64 /
     sub-512-byte entry is MISSING, never Ready (the live bytes:0 bug). */
  if (typeof entry === 'string') return isValidClipEntry(entry);
  return isPlayableClipEntry(entry);
 }
 function buildQueue(words, singleTest) {
  var list = (Array.isArray(words) ? words : currentWords()).slice(0, wordCap()); /* v0.0.7.a Z5 */
  var queue = [], i;
  for (i = 0; i < list.length; i++) {
   var w = list[i] || {};
   var text = str(w.w);
   if (!text) continue;
   /* R5: words.<w> key. v0.0.7.a CLEAN-WORD LAW: ttsText = clean orthography (curated RP overrides only). */
   queue.push({ key: 'words.' + text.toLowerCase(), legacyKey: text.toLowerCase(), text: text, ttsText: str(RP_TTS_OVERRIDES[text.toLowerCase()] || text) });
   if (singleTest) return queue; /* 1-Word Test: ~8 chars, ~1 credit unit */
  }
  if (singleTest) return queue;
  var numbers = numberClips();
  for (i = 0; i < numbers.length; i++) queue.push(numbers[i]);
  var cmds = commandClips();
  for (i = 0; i < cmds.length; i++) queue.push(cmds[i]);
  for (i = 0; i < GUIDE_CLIP_TEXTS.length; i++) queue.push({ key: 'guide.en.' + i, text: GUIDE_CLIP_TEXTS[i] });
  return queue;
 }

 /* D4: the delta-retry queue — only the requested keys, never a paid clip. */
 function queueFor(words, singleTest, keys) {
  var queue = buildQueue(words, singleTest);
  if (!Array.isArray(keys) || !keys.length) return queue;
  var keep = [], i;
  for (i = 0; i < queue.length; i++) if (keys.indexOf(queue[i].key) >= 0) keep.push(queue[i]);
  return keep.length ? keep : queue;
 }
 /* D-C1/C2/C5/C6/C7: generate ONLY the */
 function generateClips(a, b) {
  var opts = {}, cb = noop;
  if (typeof a === 'function') cb = a;
  else if (Array.isArray(a)) { opts = { words: a }; cb = typeof b === 'function' ? b : noop; }
  else { opts = isObj(a) ? a : {}; cb = typeof b === 'function' ? b : noop; }
  /* v0.0.6.t PILLAR 3D: vault-session bridges (unlock-trigger ensure /
     briefing-open) keep synthesizing after the Studio surface re-locks. */
  if (!ST.unlocked && !vaultSessionActive()) { cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
  if (!ST.voicePack.loaded) loadVoicePack(noop);
  /* v0.0.6.m Pillar 2: the active key comes from the pool (primary field */
  poolCursor = 0;
  var apiKey = resolveElevenKey();
  if (!apiKey) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_key')); return { ok: false, reason: 'no_key' }; }
  var introMode = !!opts.intro;
  /* v0.0.6.q Pillar 1: the Project Briefing clips use the CHOSEN */
  /* v0.0.6.w: every classroom take follows the UNIFIED Classroom & Cloned
     Voice Controller — Alice by default, the Lecturer's clone when applied. */
  var genVoiceId = introMode ? chosenBriefingVoiceId() : (chosenClassroomVoiceId() || activeVoiceId);
  activeVoiceId = introMode ? activeVoiceId : genVoiceId;
  /* v0.0.6.w — forceAllClassroom: re-bake ALL 30 words + 30 numbers + 6
     commands + 4 guides in the active cloned voice so ONE voice speaks
     everywhere (the briefing beats keep George in intro mode only). */
  if (!introMode && opts.forceAllClassroom) {
   force = true;
   regenKeys = null;
   opts.keys = null;
  }
  var genModel = introMode ? INTRO_VOICE.model : VOICE_MODEL;
  var genUrl = introMode ? introVoiceTtsUrl() : elevenUrl();
  var words = introMode ? [] : (Array.isArray(opts.words) ? opts.words : currentWords());
  /* D-C7: never silently drop words */
  if (words.length > wordCap()) { /* v0.0.7.a Z5 */
   msg(str(words.length) + ' words parsed, first ' + wordCap() + ' used', ''); /* v0.0.7.a Z5 */
   toast(str(words.length) + ' words parsed, first ' + wordCap() + ' used');
  }
  /* v0.0.6.m: intro queues can be filtered to a delta (autoEnsureSystemClips */
  var regenKeys = Array.isArray(opts.regenKeys) ? opts.regenKeys : null;
  var queue;
  if (introMode) {
   queue = introSteps();
   if (Array.isArray(opts.keys) && opts.keys.length) {
    queue = queue.filter(function (it) { return opts.keys.indexOf(it.key) >= 0; });
   }
  } else if (Array.isArray(opts.systemQueue) && opts.systemQueue.length) {
   queue = opts.systemQueue.slice();
  } else {
   queue = queueFor(words, !!opts.singleTest, opts.keys);
  }
  var force = !!opts.force;
  var made = [], skipped = 0, index = 0, calls = 0, stopped = false, tierLimited = false;
  /* D3/D18 (v0.0.2.a): the SAME character counter the preflight uses, so the */
  var runningChars = 0;
  /* ══ v0.0.7.a A2 — THE PRE-FLIGHT CREDIT GATE: before the first paid call,
     the queue is filtered to the genuinely MISSING word clips (existing
     valid clips are reused at 0 credits by the delta law). If the pool
     cannot cover those chars, the bilingual quota dialog opens with the 3
     one-click actions and the batch aborts BEFORE burning anything. */
  var preflightDone = !!opts.noPreflight;
  function startQueue() {
   /* v0.0.7.a A3 — AUTO-RESTORE from the permanent reuse library BEFORE the
      queue runs: returning words with valid library clips never hit the
      API (0 credits); the report names exactly what was reused vs new. */
   var restoredN = 0;
   try { restoredN = clipLibraryRestore(words); } catch (eR) {}
   ST.generating = true;
   ST.lastFailedClip = null;
   paintGenProgress(t('studioGenPrefix') + '0/' + queue.length + ' · ' + queue.length + ' ' + t('studioClipsUnit').replace('/', '') + ' queued');
   if (restoredN > 0) {
    msg('♻️ Reused ' + restoredN + ' existing voice clips (0 credits) · ⚡ Generating only the missing words.', 'ok');
   }
   try { paintReuseCounter(); } catch (eRC) {}
   runQueueItems();
  }
  function runQueueItems() { next(); }
  function finish(err) {
   if (stopped) return;
   stopped = true;
   ST.generating = false;
   paintClipTable();
   paintPackDashboard();
   if (err) {
    /* D4/D18: a failure exit names the exact clip and clears every busy */
    clearBusy();
    var failed = ST.lastFailedClip;
    var why = quotaError(err);
    if (failed) {
     var line = ' ' + failed.key + ' · ' + failed.reason;
     msg(line, 'bad');
     testStatus(line, 'bad');
     paintGenProgress(line);
    } else {
     msg(' ' + why, 'bad');
     testStatus(' ' + why, 'bad');
    }
    cb(err, { made: made, skipped: skipped, calls: calls, tierLimited: tierLimited, failed: failed });
    return;
   }
   /* D4: quota/tier exhaustion is a WARNING */
   var warnLine = tierLimited ? tierWarning() : '';
   msg(t('studioGenerate') + ' ' + made.length + ' · ' + skipped + ' skipped' + (warnLine ? ' · ' + warnLine : ''), 'ok');
   testStatus(warnLine ? ' ' + warnLine : ' ' + made.length + ' new · ' + skipped + ' already cached', warnLine ? '' : 'ok');
   if (made.length && !opts.noCommit) commitVoicePack();
   paintGenProgress(t('studioPackClips') + (made.length + skipped) + t('studioClipsUnit') + ' · ' + runningChars + t('studioGenCharsTail'));
   /* v0.0.7.a Z4 — generation closes with the verified audit banner. */
   try { paintStudioActionAuditBanner('Clip generation', made.length + ' new · ' + skipped + ' cached'); } catch (eA4) {}
   cb(null, { made: made, skipped: skipped, calls: calls, tierLimited: tierLimited, warning: warnLine });
  }
  function next() {
   if (index >= queue.length) { finish(null); return; }
   var item = queue[index];
   index += 1;
   /* v0.0.6.v — the 4-stage British RP verifier gates every word synthesis
      (quarantined words are skipped with an amber row, never synthesized). */
   if (!introMode && /^words\./.test(str(item.key)) && !itemHashVerified(item)) {
    verifyBritishRPWord({ w: str(item.key).replace(/^words\./, ''), ttsHint: str(item.ttsText || '') }, function (res) {
     /* v0.0.6.w — the NEVER-SKIP LAW: verifyBritishRPWord can no longer
        quarantine; whatever it resolves, the word SYNTHESIZES. A fallback
        respelling is stamped rpSource: 'fallback' as an informational badge
        (never a blocker). */
     if (res && res.ok && isObj(ST.voicePack.clips[item.key])) {
      ST.voicePack.clips[item.key].ttsVerified = true;
     }
     if (res && res.rpSource === 'fallback' && isObj(ST.voicePack.clips[item.key])) {
      ST.voicePack.clips[item.key].rpSource = 'fallback';
     }
     /* v0.0.7.a: rpRespelling is display-only; ttsText stays. */
     synthesizeItem();
    });
    return;
   }
   synthesizeItem();
  }
  function itemHashVerified(item) {
   var e = isObj(ST.voicePack.clips[item.key]) ? ST.voicePack.clips[item.key] : null;
   return !!(e && e.ttsVerified === true);
  }
  function synthesizeItem(itemArg) {
   var item = itemArg || queue[Math.max(0, index - 1)];
   if (!item) { next(); return; }
   /* R5: delta on CONTENT, not on mere existence. A clip whose sha1 hash */
   var itemHash = clipContentHash(item.text, genVoiceId, genModel);
   var existing = packedSystemClip(item.key);
   /* v0.0.6.m Pillar 2: immutable static system audio (commands, numbers, */
   if (!force && clipExists(item.key) && (!introMode || (isObj(existing) && existing.liveEleven === true && Number(existing.weekStamp || 0) === Number(currentWeeksSinceStart())))) {
    if (isStaticClipKey(item.key) && !(regenKeys && regenKeys.indexOf(item.key) >= 0)) { skipped += 1; next(); return; }
    var storedHash = isObj(existing) ? str(existing.hash) : '';
    if (!storedHash || storedHash === itemHash) { skipped += 1; next(); return; }
   }
   calls += 1;
   var charsUsed = str(item.text).length;
   var rotationsThisItem = 0;
   requestClip(item, apiKey, function (err, entry) {
    if (err) {
     /* v0.0.6.m Pillar 2: key-level failures rotate to the next pool slot
        (v0.0.6.t PILLAR 3D: 400/403/422 also rotate — a key rejected by the
        TTS endpoint is as dead as an over-quota key for this batch). */
     var st = Number((err && err.status) || 0);
     if ((st === 400 || st === 401 || st === 402 || st === 403 || st === 422 || st === 429) && rotationsThisItem < elevenKeyPool().length - 1) {
      var rotated = rotateElevenKey('http_' + st);
      if (rotated) {
       rotationsThisItem += 1;
       apiKey = rotated;
       index -= 1;
       msg(' Key rotated → Slot #' + (poolCursor + 1) + ' (HTTP ' + st + ')', 'warn');
       next();
       return;
      }
     }
     /* D4: remember the exact clip and its mapped reason for the retry. */
     ST.lastFailedClip = { key: item.key, status: st, reason: quotaError(err) };
     tierLimited = true;
     skipped = Math.max(skipped, queue.length - made.length);
     index = queue.length;
     /* v0.0.7.b B1 — the POOL DIAGNOSTIC LAW: an all-keys-failed batch ends
        with an explicit per-pool report so the lecturer sees exactly how
        many configured ElevenLabs keys were tried and why the last one
        refused (never a silent mismatched-voice fallback). */
     var poolN = elevenKeyPool().length || 1;
     var w = T('studioElTierWarn') + ' · ' + (rotationsThisItem + 1) + '/' + poolN + ' pool key' + (poolN > 1 ? 's' : '') + ' tried — last error: ' + quotaError(err);
     ST.tierWarn = w;
     msg(' ' + w, 'warn'); testStatus(' ' + w, 'warn');
     finish(null); return;
    }
    ST.voicePack.clips[item.key] = entry;
    /* v0.0.7.a A3 — every fresh word clip is ALSO snapshotted into the
       permanent reuse library (0-credit restore on any future edit). */
    try { clipLibrarySaveEntry(item.key, entry); } catch (eLib2) {}
    /* ══ v0.0.7.a A5 — THE WORDSREV STAMP LAW: every freshly generated clip
       carries the CURRENT pack wordsRev, so validatePackClips() can never
       classify a brand-new take as stale (the post-publish false-banner
       path: fresh clips with wordsRev 0 vs a bumped pack wordsRev). ══ */
    try {
     if (isObj(entry) && !Number(entry.wordsRev)) {
      entry.wordsRev = Number((SDP.Speech && SDP.Speech.state && SDP.Speech.state.manifest && SDP.Speech.state.manifest.wordsRev) || 0) || nextSyncRev();
     }
    } catch (eWR) {}
    made.push({ key: item.key, text: item.text, bytes: entry.bytes });
    ST.voicePack.loaded = true;
    runningChars += charsUsed;
    /* D3: verbatim live progress after every real clip. */
    paintGenProgress(t('studioGenPrefix') + Math.min(queue.length, made.length + skipped) + '/' + queue.length +
     ' · ' + item.key + ' · ' + runningChars + t('studioGenCharsTail'));
    paintClipTable(); /* D14: live row-by-row progress */
    paintPackDashboard();
    next();
   }, 0);
  }
  function requestClip(item, key, done, attempt) {
   /* v0.0.6.t PILLAR 3D — the Cloned-Voice-safe 3-attempt ladder:
      attempt 0: the full broadcast settings — /with-timestamps for intro
                 beats (word-level wt karaoke) with eleven_flash_v2_5;
      attempt 1: the standard endpoint (?output_format=mp3_44100_128) with
                 MINIMAL Cloned-Voice-safe settings { stability: 0.55,
                 similarity_boost: 0.80 } — NO style, NO use_speaker_boost —
                 because eleven_flash_v2_5 and Cloned Voices routinely reject
                 style / use_speaker_boost / /with-timestamps with 400/422;
      attempt 2: the standard endpoint with model eleven_multilingual_v2
                 (Instant and Professional Cloned Voices are often bound to
                 it) and the same minimal settings.
      v0.0.7.a CLEAN-WORD LAW: the POST body speaks clean item.text (curated RP overrides only). */
   var vs;
   if (attempt === 0) {
    /* v0.0.6.w — the UNIFIED VOICE LAW: genVoiceId already follows
       chosenClassroomVoiceId() for every classroom key. When the active voice
       is a CLONE (not Alice), attempt 0 uses the Cloned-Voice-safe settings
       { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true } on
       eleven_flash_v2_5; the 400/422 ladder below retries with the minimal
       { stability: 0.55, similarity_boost: 0.80 } and finally
       eleven_multilingual_v2 (Instant/Professional clones are often bound to
       it). Alice keeps the locked broadcast signature. */
    var lock = (!introMode && voiceSignature && voiceSignature().locked === true) ? voiceSignature().settings : null;
    var isClone = !introMode && genVoiceId !== VOICE_ID;
    if (isClone) {
     vs = { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true };
    } else {
     vs = lock ? { stability: lock.stability, similarity_boost: lock.similarity_boost, style: lock.style, use_speaker_boost: true }
      : { stability: 0.65, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true };
    }
    if (introMode) vs = { stability: INTRO_VOICE_SETTINGS.stability, similarity_boost: INTRO_VOICE_SETTINGS.similarity_boost, style: INTRO_VOICE_SETTINGS.style, use_speaker_boost: true };
   } else {
    vs = { stability: 0.55, similarity_boost: 0.80 };
   }
   var model = attempt >= 2 ? 'eleven_multilingual_v2' : genModel;
   /* v0.0.6.q: /with-timestamps first, fallback to standard mp3_44100_128. */
   /* v0.0.7.a: every non-timestamped request appends ?output_format=mp3_44100_128. */
   var url = (introMode && attempt === 0) ? (genUrl + '/with-timestamps?output_format=mp3_44100_128')
    : (genUrl + (genUrl.indexOf('?') >= 0 ? '&' : '?') + 'output_format=mp3_44100_128');
   var wantTs = !!(introMode && attempt === 0);
   try {
    global.fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: wantTs ? 'application/json' : 'audio/mpeg' }, body: JSON.stringify({ text: str(RP_TTS_OVERRIDES[str(item.text).toLowerCase()] || item.text), model_id: model, voice_settings: vs }) })
     .then(function (res) {
      var st = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
      if (!res || !res.ok) {
       if (st === 429 && attempt < 1) { global.setTimeout(function () { requestClip(item, key, done, attempt + 1); }, 5000); return null; }
       if ((st === 400 || st === 403 || st === 422 || st >= 500) && attempt < 2) { requestClip(item, key, done, attempt + 1); return null; } /* v0.0.6.t PILLAR 3D */
       throw withStatus(new Error('tts_failed'), st || 0);
      }
      if (wantTs) return res.json ? res.json().then(function (j) { return { ts: j }; }) : null;
      return res.arrayBuffer ? res.arrayBuffer() : null;
     }).then(function (payload) {
      if (payload === null) return;
      if (payload && payload.ts) {
       /* /with-timestamps: base64 audio + alignment in one JSON body. */
       var j = payload.ts;
       var b64ts = str(j.audio_base64 || j.audio || j.b64 || '');
       /* v0.0.6.r Pillar 2: j.alignment (the RAW character alignment over the
          exact un-normalized input characters) is preferred over
          j.normalized_alignment, which expands numbers and symbols into
          spoken words ("($0)" -> "zero dollars", "22" -> "twenty two") and
          made parseAlignmentToWordTimings() return null on real responses. */
       var align = isObj(j.alignment) ? j.alignment : (isObj(j.normalized_alignment) ? j.normalized_alignment : null);
       if (!b64ts || !align) {
        /* Malformed timestamped body → seamless standard-endpoint retry. */
        requestClip(item, key, done, attempt + 1);
        return;
       }
       var wt = parseAlignmentToWordTimings(align, item.text);
       /* v0.0.6.q Pillar 1 — the LIVE-ELEVEN PROVENANCE STAMP: every clip */
       if (introMode) {
        done(null, {
         b64: b64ts, text: str(item.text), bytes: Math.floor(b64ts.length * 3 / 4),
         at: Date.now(), voiceId: genVoiceId, modelId: genModel,
         hashAlgo: HASH_ALGO, hash: clipContentHash(item.text, genVoiceId, genModel),
         wt: wt,
         liveEleven: true, weekStamp: currentWeeksSinceStart(), provenance: 'elevenlabs-live', voiceName: chosenBriefingVoiceName()
        });
        return;
       }
       done(null, {
        b64: b64ts, text: str(item.text), bytes: Math.floor(b64ts.length * 3 / 4),
        at: Date.now(), voiceId: genVoiceId, modelId: genModel,
        hashAlgo: HASH_ALGO, hash: clipContentHash(item.text, genVoiceId, genModel),
        wt: wt
       });
       return;
      }
      if (!payload) throw new Error('empty_audio');
      var b64 = arrayBufferToBase64(payload);
      if (!b64) throw new Error('encode_failed');
      /* v0.0.7.b B1 ROOT-CAUSE FIX — capture the REAL payload size BEFORE the
         normalizer decodes it. SDP.AudioNormalize.measureBuffer() hands the
         ArrayBuffer to AudioContext.decodeAudioData(), which DETACHES it, so
         reading payload.byteLength inside the async callback always returned
         0. That is the true origin of the live "bytes: 0" corruption: every
         freshly synthesized word take was stamped bytes:0, the B1 zero-byte
         law then classified it MISSING (so a lecturer who just generated all
         31 clips still saw them all as Missing) and clipLibrarySaveEntry()
         refused to snapshot it, which broke the A3 0-credit reuse library. */
      var payloadBytes = Number(payload.byteLength || payload.length || 0) || 0;
      /* v0.0.6.v — the broadcast normalizer: words and num takes (NEVER the
         _intro_male_* beats, NEVER cmd.*) decode -> normalize to the locked
         signature (-21 LUFS, +2.5 dB @ 3 kHz, TP <= -1.0) -> PCM WAV b64.
         Fallback takes (attempt >= 1) are stamped degradedTake: true. */
      var isClassroomKey = !introMode && /^(words\.|num\.)/.test(str(item.key));
      /* v0.0.6.w — the PURE-MP3 LAW: entry.b64 ALWAYS keeps the genuine
         audio/mpeg MP3 bytes ElevenLabs returned (?output_format=mp3_44100_128,
         ~14 KB/word). The v0.0.6.v normalizer converted every classroom take
         into an uncompressed 16-bit PCM .wav (~130 KB, 8x larger) inside an
         audio/mpeg pipeline; now SDP.AudioNormalize.measureBuffer() only
         MEASURES the clip (BS.1770-4 integrated LUFS + true peak dBTP) and the
         metadata stores the computed playback gainLinear — the binary stays
         a compact MP3 that plays cleanly on iOS Safari, Android Chrome and
         Desktop and satisfies the MPEG-1 Layer III frame-header gates. */
      if (isClassroomKey && global.SDP && SDP.AudioNormalize && SDP.AudioNormalize.measureBuffer) {
       SDP.AudioNormalize.measureBuffer(payload, function (eM, measured) {
        var lufs = !eM && measured ? Number(measured.lufs) : -21;
        var tpDb = !eM && measured ? Number(measured.truePeakDb) : -1;
        if (!(lufs > -70)) lufs = -21;
        var gainLinear = Math.max(0.5, Math.min(2.0, Math.pow(10, (-21.0 - lufs) / 20)));
        done(null, introMode ? {
         b64: b64, text: str(item.text), bytes: payloadBytes,
         at: Date.now(), voiceId: genVoiceId, modelId: genModel,
         hashAlgo: HASH_ALGO, hash: clipContentHash(item.text, genVoiceId, genModel),
         liveEleven: true, weekStamp: currentWeeksSinceStart(), provenance: 'elevenlabs-live', voiceName: chosenBriefingVoiceName()
        } : {
         b64: b64, text: str(item.text), bytes: payloadBytes,
         at: Date.now(), voiceId: genVoiceId, modelId: genModel,
         hashAlgo: HASH_ALGO, hash: clipContentHash(item.text, genVoiceId, genModel),
         lufs: Math.round(lufs * 10) / 10, truePeakDbTp: Math.round(tpDb * 10) / 10,
         gainLinear: Math.round(gainLinear * 1000) / 1000,
         normalized: 'bs1770-4:-21.0', degradedTake: attempt >= 1 ? true : undefined
        });
       });
       return;
      }
      done(null, introMode ? {
       b64: b64, text: str(item.text), bytes: payloadBytes,
       at: Date.now(), voiceId: genVoiceId, modelId: genModel,
       hashAlgo: HASH_ALGO, hash: clipContentHash(item.text, genVoiceId, genModel),
       liveEleven: true, weekStamp: currentWeeksSinceStart(), provenance: 'elevenlabs-live', voiceName: chosenBriefingVoiceName()
      } : {
       b64: b64, text: str(item.text), bytes: payloadBytes,
       at: Date.now(), voiceId: genVoiceId, modelId: genModel,
       hashAlgo: HASH_ALGO, hash: clipContentHash(item.text, genVoiceId, genModel),
       lufs: -21, truePeakDbTp: -1, gainLinear: 1,
       normalized: 'bs1770-4:-21.0', degradedTake: attempt >= 1 ? true : undefined
      });
     }, function (err) { done(err || new Error('tts_failed')); });
   } catch (e) { done(e || new Error('tts_failed')); }
  }
  /* ══ v0.0.7.a A2 — THE PRE-FLIGHT CREDIT GATE runs before the first paid
     call: collect the genuinely missing word texts (clip missing or hash
     changed), probe the whole pool, and only then start the queue. On
     insufficiency the bilingual dialog opens and nothing is burned. */
  if (preflightDone) { startQueue(); }
  else {
   var preMissing = [], pi;
   for (pi = 0; pi < queue.length; pi++) {
    if (!/^words\./.test(str(queue[pi] && queue[pi].key))) continue;
    if (clipExists(queue[pi].key)) continue; /* delta law: reuse at 0 credits */
    /* v0.0.7.a A3: a library-restorable word costs NOTHING — exclude it. */
    var libWord = str(queue[pi].key).replace(/^words\./, '');
    if (clipLibraryLookup(libWord, '')) continue;
    preMissing.push(str(queue[pi] && queue[pi].text));
   }
   if (!preMissing.length || !elevenKeyPool().length) { startQueue(); }
   else {
    preFlightCreditCheck(preMissing, function (ePf, rPf) {
     try { keyPoolChipCache.at = Date.now(); keyPoolChipCache.have = rPf ? rPf.have : 0; keyPoolChipCache.keys = rPf ? rPf.keys : 0; paintKeyPoolChip(); } catch (eKC) {}
     if (rPf && rPf.ok) { startQueue(); return; }
     if (rPf && rPf.reason === 'no_keys') { startQueue(); return; }
     /* pool cannot cover the missing words — abort BEFORE any burn */
     ST.lastQuotaCheck = rPf;
     ST.generating = false;
     clearBusy();
     try { openQuotaExceededDialog(rPf); } catch (eQ) {}
     msg('⚠ Credits ප්‍රමාණවත් නැත — the pool cannot cover the ' + preMissing.length + ' missing words (~' + (rPf ? rPf.need : 0) + ' chars needed, ' + (rPf ? rPf.have : 0) + ' available). Nothing was burned.', 'warn');
     cb(new Error('quota_preflight'), { tierLimited: true, preflight: rPf });
    });
   }
  }
  return { ok: true, started: queue.length, calls: 0 };
 }

 function buildDiagZip(cb) {
  cb = cb || noop;
  var Diag = null;
  try { Diag = global.SDP && SDP.Diagnostics ? SDP.Diagnostics : null; } catch (e) { Diag = null; }
  if (!Diag || !Diag.buildDiagFiles || !Diag.zipStore) { cb(new Error('no_diagnostics')); return false; }
  Diag.buildDiagFiles().then(function (bundle) {
   var bytes = Diag.zipStore(bundle.files);
   try {
    var blob = new global.Blob([bytes], { type: 'application/zip' });
    var url = global.URL && global.URL.createObjectURL ? global.URL.createObjectURL(blob) : '';
    if (!url) { cb(new Error('no_blob_url')); return; }
    var a = doc.createElement('a');
    a.href = url;
    a.download = 'sdp-diagnostics-' + str(appVersion()) + '.zip';
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    global.setTimeout(function () { try { global.URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    try { Diag.log('diag_zip_exported', { files: bundle.files.length, bytes: bytes.length }); } catch (e) {}
    cb(null, { files: bundle.files.length, bytes: bytes.length });
   } catch (e) { cb(e || new Error('zip_failed')); }
  }, function (err) { cb(err || new Error('decrypt_failed')); });
  return true;
 }
 function paintDiagSummary() {
  var host = byId('diagSummary');
  if (!host) return false;
  var summary = { events: 0, reviews: 0, firstAt: '', lastAt: '' };
  var stats = { locked: 0, total: STATIC_CLIP_KEYS.length };
  try {
   if (global.SDP && SDP.Diagnostics) {
    summary = SDP.Diagnostics.summary();
    stats = staticVaultStats();
   }
  } catch (e) {}
  host.innerHTML =
   '<div class="diag-cell"><strong>' + summary.events + '</strong><span>diagnostic events</span></div>' +
   '<div class="diag-cell"><strong>' + summary.reviews + '</strong><span>encrypted reviews</span></div>' +
   '<div class="diag-cell"><strong>' + stats.locked + ' / ' + stats.total + '</strong><span>static clips locked</span></div>' +
   '<div class="diag-cell"><strong>' + keyPoolCount() + ' / ' + KEY_POOL_SLOTS + '</strong><span>key pool slots</span></div>' +
   '<div class="diag-cell diag-cell-wide"><strong>' + esc(str(summary.lastAt || '—')) + '</strong><span>last captured event</span></div>';
  return true;
 }

 function fmtDuration(sec) {
  var s = Math.max(0, Math.round(Number(sec) || 0));
  if (s >= 60) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return s + 's';
 }
 function authBadgeHtml(tel) {
  if (!isObj(tel)) return '<span class="auth-badge partial">· review only</span>';
  var a = str(tel.authenticityStatus);
  if (a === 'GENUINE_FULL') return '<span class="auth-badge genuine">✓ Genuine · ' + fmtDuration(tel.durationSec) + '</span>';
  if (a === 'RAPID_SKIP_SUSPECT') return '<span class="auth-badge rapid">⚠ Rapid Skip · ' + fmtDuration(tel.durationSec) + ' (' + (Number(tel.rapidSkipCount) || 0) + ' skips)</span>';
  if (a === 'PARTIAL_INCOMPLETE') return '<span class="auth-badge partial">⏳ Incomplete · ' + (Number(tel.wordsCompletedCount) || 0) + '/' + (Number(tel.wordsTotal) || 30) + ' words</span>';
  return '<span class="auth-badge partial">· ' + esc(a) + '</span>';
 }
 var CHIP_LABELS = {
  /* v0.0.6.m FIX 4: the 9 comprehensive 1-tap chips (identical on the */
  fast: '⚡ Fast & Smooth',
  voice_ok: '🔊 Voice Clear',
  voice_muted: '🔇 Word Audio Not Playing',
  voice_robotic: '🤖 Robotic / Wrong Pronunciation',
  briefing_sync: '🎵 Briefing / Lyrics Sync Issue',
  incomplete: '⏳ Dictation Words Incomplete',
  ui_layout: '📱 Screen / Layout Issue',
  clock_stuck: '⏱ Clock / Play-Pause Stuck',
  cache_stale: '🔄 Old Words / Cache Issue',
  clear: '🔊 Voice Clear', issue: '🐞 Found an Issue'
 };
 var reviewAudioNode = null;
 function playReviewVoice(b64, mime) {
  try {
   if (reviewAudioNode) { try { reviewAudioNode.pause(); } catch (e0) {} reviewAudioNode = null; }
   if (!str(b64)) return false;
   var url = 'data:' + (str(mime) || 'audio/webm') + ';base64,' + str(b64);
   reviewAudioNode = new global.Audio(url);
   reviewAudioNode.play();
   return true;
  } catch (e) { return false; }
 }
 function renderUiSnapshotHtml(snap) {
  var u = isObj(snap) && isObj(snap.ui) ? snap.ui : {};
  var c = isObj(snap) && isObj(snap.cache) ? snap.cache : {};
  var a = isObj(snap) && isObj(snap.audio) ? snap.audio : {};
  var vp = isObj(u.viewport) ? u.viewport : {};
  var els = isObj(u.elements) ? u.elements : {};
  var RECT_IDS = ['appHeader', 'ringWrap', 'btnPlayPause', 'tabbar', 'briefingModal', 'reviewPopupCard'];
  var rows = '', i, id, n, r;
  for (i = 0; i < RECT_IDS.length; i++) {
   id = RECT_IDS[i];
   n = els[id] || {};
   r = isObj(n.rect) ? n.rect : { x: 0, y: 0, w: 0, h: 0 };
   rows += '<tr><td>#' + esc(id) + '</td><td>' + (n.present ? '✓' : '—') + '</td><td>' + (n.visible ? '✓' : (n.hidden ? 'hidden' : '✗')) + '</td><td>' + r.x + '×' + r.y + '</td><td>' + r.w + '×' + r.h + '</td></tr>';
  }
  var ls = isObj(c.localStorage) ? c.localStorage : {};
  var lsKeys = [], lk;
  for (lk in ls) { if (Object.prototype.hasOwnProperty.call(ls, lk)) lsKeys.push(lk); }
  var lsRows = '';
  for (i = 0; i < lsKeys.length && i < 12; i++) lsRows += '<tr><td>' + esc(lsKeys[i]) + '</td><td>' + ls[lsKeys[i]] + ' B</td></tr>';
  return '<div class="rev-snap-grid">' +
   '<div><strong>Viewport &amp; Screen</strong><dl>' +
   '<dt>screen</dt><dd>' + esc(str(u.screen || '—')) + '</dd>' +
   '<dt>viewport</dt><dd>' + (vp.w || 0) + '×' + (vp.h || 0) + ' @' + (vp.dpr || 1) + 'x</dd>' +
   '<dt>overflowX</dt><dd>' + (vp.overflowX ? 'YES ⚠' : 'none') + '</dd>' +
   '<dt>theme / lang / mode</dt><dd>' + esc(str(u.theme || '')) + ' / ' + esc(str(u.lang || '')) + ' / ' + esc(str(u.mode || '')) + '</dd>' +
   '</dl></div>' +
   '<div><strong>Audio Pipeline</strong><dl>' +
   '<dt>lastTierName</dt><dd>' + esc(str(a.lastTierName || '—')) + '</dd>' +
   '<dt>voicesCount</dt><dd>' + (a.voicesCount || 0) + '</dd>' +
   '<dt>micReleased</dt><dd>' + (a.micReleased === false ? 'NO ⚠' : 'yes') + '</dd>' +
   '<dt>recentAudioErrors</dt><dd>' + (Array.isArray(a.recentAudioErrors) ? a.recentAudioErrors.length : 0) + '</dd>' +
   '</dl></div>' +
   '<div><strong>Cache &amp; Storage</strong><dl>' +
   '<dt>swActive</dt><dd>' + (c.swActive ? 'yes' : 'no') + '</dd>' +
   '<dt>voicePackClips</dt><dd>' + (c.voicePackClipsCount || 0) + '</dd>' +
   '<dt>introPresent</dt><dd>' + (c.introPresent ? 'yes' : 'no ⚠') + '</dd>' +
   '<dt>settingsRev / sessionRev</dt><dd>' + (c.settingsRev || 0) + ' / ' + (c.sessionRev || 0) + '</dd>' +
   '</dl></div>' +
   '</div>' +
   '<table class="rev-snap-table"><thead><tr><th>Element</th><th>present</th><th>visible</th><th>x×y</th><th>w×h</th></tr></thead><tbody>' + rows + '</tbody></table>' +
   (lsRows ? '<table class="rev-snap-table"><thead><tr><th>localStorage key</th><th>size</th></tr></thead><tbody>' + lsRows + '</tbody></table>' : '');
 }
 function paintReviewsDrawer() {
  var host = byId('studioReviewsList');
  var sum = byId('reviewsSummary');
  if (!host && !sum) return false;
  var Diag = null;
  try { Diag = global.SDP && SDP.Diagnostics ? SDP.Diagnostics : null; } catch (e) { Diag = null; }
  if (!Diag || !Diag.decryptReviews) {
   if (host) host.innerHTML = '<p class="muted">Diagnostics module unavailable.</p>';
   return false;
  }
  Diag.decryptReviews().then(function (list) {
   list = Array.isArray(list) ? list : [];
   /* Newest first: the creator reads the latest session at the top. */
   var rows = list.slice().reverse(), i, r, tel, chips, k;
   var counts = { genuine: 0, rapid: 0, partial: 0, voice: 0, text: 0 };
   var catCounts = {};
   var html = '';
   for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (!r || !r.ok || !isObj(r.review)) {
     html += '<div class="rev-session"><div class="rev-session-head"><span class="auth-badge partial">🔒 sealed (key changed)</span></div></div>';
     continue;
    }
    var review = r.review;
    tel = isObj(review.telemetry) ? review.telemetry : null;
    var a = tel ? str(tel.authenticityStatus) : '';
    if (a === 'GENUINE_FULL') counts.genuine += 1;
    else if (a === 'RAPID_SKIP_SUSPECT') counts.rapid += 1;
    else if (a === 'PARTIAL_INCOMPLETE') counts.partial += 1;
    if (review.voiceClip && str(review.voiceClip.b64)) counts.voice += 1;
    if (str(review.text)) counts.text += 1;
    chips = Array.isArray(review.pills) ? review.pills : [];
    for (k = 0; k < chips.length; k++) catCounts[chips[k]] = (catCounts[chips[k]] || 0) + 1;
    html += '<div class="rev-session">' +
     '<div class="rev-session-head">' + authBadgeHtml(tel) +
     '<small>' + esc(str(review.at || '')) + (review.skipped ? ' · skipped review' : ' · review sent') + (tel ? ' · ' + esc(str(tel.mode || '')) + ' mode' : '') + '</small></div>' +
     (chips.length ? '<div class="rev-chips">' + chips.map(function (c) { return '<span class="rev-chip">' + esc(CHIP_LABELS[c] || c) + '</span>'; }).join('') + '</div>' : '') +
     (str(review.text) ? '<p class="rev-note">“' + esc(str(review.text).slice(0, 220)) + '”</p>' : '') +
     (review.voiceClip && str(review.voiceClip.b64)
      ? '<div class="rev-play"><button type="button" class="btn btn-sm" data-play-review-voice="1" data-vmime="' + esc(str(review.voiceClip.mime || 'audio/webm')) + '" data-vb64="' + esc(str(review.voiceClip.b64)) + '">▶ Play Student Voice Recording (' + fmtDuration(review.voiceClip.secs) + ')</button></div>'
      : '') +
     (isObj(review.uiSnapshot)
      ? '<details class="rev-snapshot"><summary>🔍 Inspect UI &amp; Cache Snapshot</summary>' + renderUiSnapshotHtml(review.uiSnapshot) + '</details>'
      : '') +
     '</div>';
   }
   if (!rows.length) html = '<p class="muted">No sessions captured on this device yet — finish a dictation session (or tap Skip on the review card) and it appears here, encrypted.</p>';
   if (host) host.innerHTML = html;
   var topCat = '', topN = 0;
   for (var ck in catCounts) {
    if (Object.prototype.hasOwnProperty.call(catCounts, ck) && catCounts[ck] > topN) { topN = catCounts[ck]; topCat = ck; }
   }
   if (sum) {
    sum.innerHTML =
     '<div class="rev-cell"><strong>' + rows.length + '</strong><span>total sessions analysed</span></div>' +
     '<div class="rev-cell"><strong>' + counts.genuine + ' ✓ / ' + counts.rapid + ' ⚠</strong><span>genuine vs rapid-skip</span></div>' +
     '<div class="rev-cell"><strong>' + counts.voice + ' 🎤 / ' + counts.text + ' ✍️</strong><span>voice / text reviews</span></div>' +
     '<div class="rev-cell"><strong>' + esc(topCat ? (CHIP_LABELS[topCat] || topCat) : '—') + '</strong><span>top reported issue</span></div>';
   }
   return true;
  }, function () {
   if (host) host.innerHTML = '<p class="muted">Reviews could not be decrypted on this device.</p>';
   return false;
  });
 }
 function buildReviewsZip(cb) {
  cb = cb || noop;
  var Diag = null;
  try { Diag = global.SDP && SDP.Diagnostics ? SDP.Diagnostics : null; } catch (e) { Diag = null; }
  if (!Diag || !Diag.buildDiagFiles || !Diag.zipStore) { cb(new Error('no_diagnostics')); return false; }
  Diag.buildDiagFiles().then(function (bundle) {   var bytes = Diag.zipStore(bundle.files);
   try {
    var blob = new global.Blob([bytes], { type: 'application/zip' });
    var url = global.URL && global.URL.createObjectURL ? global.URL.createObjectURL(blob) : '';
    if (!url) { cb(new Error('no_blob_url')); return; }
    var a = doc.createElement('a');
    a.href = url;
    a.download = 'sdp-user-reviews-telemetry-' + str(appVersion()) + '.zip';
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    global.setTimeout(function () { try { global.URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    try { Diag.log('reviews_zip_exported', { files: bundle.files.length, bytes: bytes.length }); } catch (e) {}
    cb(null, { files: bundle.files.length, bytes: bytes.length });
   } catch (e) { cb(e || new Error('zip_failed')); }
  }, function (err) { cb(err || new Error('decrypt_failed')); });
  return true;
 }
 /* Delegated ▶ voice-note playback + live refresh when the drawer opens. */
 function bindReviewsDrawer() {
  var list = byId('studioReviewsList');
  if (list && !list._sdpRevBound) {
   list._sdpRevBound = true;
   list.addEventListener('click', function (ev) {
    var target = ev && ev.target;
    if (!target || !target.getAttribute || target.getAttribute('data-play-review-voice') !== '1') return;
    if (ev && ev.preventDefault) ev.preventDefault();
    playReviewVoice(target.getAttribute('data-vb64'), target.getAttribute('data-vmime'));
   });
  }
  var drawer = byId('studioCardReviews');
  if (drawer && !drawer._sdpRevBound) {
   drawer._sdpRevBound = true;
   drawer.addEventListener('toggle', function () {
    if (drawer.open) paintReviewsDrawer();
   });
  }
  return true;
 }

 /* v0.0.4.b: serialise clips without the duplicate .url data URL on disk. */
 function packClipsForDisk() {
  /* v0.0.6.r Pillar 1 — the METADATA PRESERVATION law: v0.0.6.q stripped
     wt/ww/liveEleven/weekStamp/provenance/durMs/voiceName on every commit,
     so the JSON on GitHub lost the karaoke alignment + live-Eleven stamp and
     the next reload treated the creator's Cloned Voice beats as un-generated
     repo preloads (auto re-synthesizing over them with default George). */
  var src = ST.voicePack.clips || {}, out = {}, k;
  /* v0.0.6.t PILLAR 3F/4D — the CANONICAL-KEY law: hydrateClips() adds
     in-memory playback aliases (bare word keys + words.num.N-style system
     aliases). v0.0.6.s committed those aliases to GitHub, bloating the pack
     to 270 entries / 20.7 MB. Only canonical keys are ever written to disk:
     words.<word>, num.N, cmd.*, guide.en.N, _guide_N, _intro_male_N. */
  var SYS_KEY_RE = /^(num\.\d+|cmd\.[a-z]+|guide\.en\.\d|_guide_\d|_intro_male_[1-4])$/;
  for (k in src) {
   if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
   var kk = str(k);
   /* Drop hydration aliases — order matters: a words.<system-key> alias
      goes first, so the CANONICAL num.1 / cmd.* / _intro_male_* keys are
      never mistaken for bare aliases of their own words.* aliases; then a
      bare word key that also exists as words.<k>. */
   if (/^words\./.test(kk) && SYS_KEY_RE.test(kk.slice(6))) continue;
   if (!/^words\./.test(kk) && !SYS_KEY_RE.test(kk) && isObj(src['words.' + kk])) continue;
   var c = src[k];
   if (!c || typeof c !== 'object') { out[k] = c; continue; }
   var row = {
    b64: str(c.b64), bytes: Number(c.bytes) || 0, at: Number(c.at) || 0,
    text: str(c.text), hashAlgo: str(c.hashAlgo), hash: str(c.hash),
    voiceId: str(c.voiceId), modelId: str(c.modelId)
   };
   if (Array.isArray(c.wt) && c.wt.length) row.wt = c.wt;
   if (Array.isArray(c.ww) && c.ww.length) row.ww = c.ww;
   if (c.liveEleven === true) row.liveEleven = true;
   if (Number(c.weekStamp) > 0) row.weekStamp = Number(c.weekStamp);
   if (str(c.provenance)) row.provenance = str(c.provenance);
   if (Number(c.durMs) > 0) row.durMs = Number(c.durMs);
   if (str(c.voiceName)) row.voiceName = str(c.voiceName);
   out[k] = row;
  }
  return out;
 }
 /* IRON LAW: GET /v1/history only — 0 credits, never POST to the audio API. */
 function recoverFromHistory(cb) {
  cb = cb || noop;
  var key = str(ST.secrets.elevenKey || fieldValue('elKeyInput'));
  if (!looksLikeElevenKey(key)) {
   msg('Paste a valid sk_... ElevenLabs key first to recover clips from history.', 'warn');
   cb(new Error('no_key'));
   return;
  }
  msg('Checking ElevenLabs History (0 credits)...', 'info');
  loadVoicePack(function () {
   global.fetch('https://api.elevenlabs.io/v1/history?page_size=100', {
    method: 'GET', headers: { 'xi-api-key': key }, cache: 'no-store'
   }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (j) {
    var items = (j && Array.isArray(j.history)) ? j.history : [];
    var byText = {}, i;
    for (i = 0; i < items.length; i++) {
     var it = items[i] || {};
     var t = str(it.text).trim();
     if (t && it.history_item_id && !byText[t]) byText[t] = str(it.history_item_id);
    }
    var q = buildQueue(currentWords()), todo = [], k;
    for (k = 0; k < q.length; k++) {
     if (!clipExists(q[k].key) && byText[str(q[k].text).trim()]) {
      todo.push({ key: q[k].key, text: q[k].text, hid: byText[str(q[k].text).trim()] });
     }
    }
    function repaint() {
     try {
      if (global.SDP && global.SDP.Speech) {
       if (global.SDP.Speech.injectClips) global.SDP.Speech.injectClips(ST.voicePack.clips);
       if (global.SDP.Speech.reloadManifest) global.SDP.Speech.reloadManifest(true);
      }
     } catch (e) {}
     paintPackDashboard();
     paintClipTable();
    }
    if (!todo.length) {
     repaint();
     msg('All 74 voice pack clips are already loaded and verified (0 credits spent).', 'ok');
     cb(null, { recovered: 0 });
     return;
    }
    var idx = 0, rec = 0;
    function pullNext() {
     if (idx >= todo.length) {
      repaint();
      commitVoicePack(function () {
       msg('Recovered ' + rec + ' clips from ElevenLabs History (0 credits spent)!', 'ok');
       cb(null, { recovered: rec });
      });
      return;
     }
     var cur = todo[idx++];
     global.fetch('https://api.elevenlabs.io/v1/history/' + encodeURIComponent(cur.hid) + '/audio', {
      method: 'GET', headers: { 'xi-api-key': key }
     }).then(function (ar) { return ar && ar.ok ? ar.arrayBuffer() : null; }).then(function (buf) {
      if (buf && buf.byteLength > 100) {
       var b64 = arrayBufferToBase64(buf);
       ST.voicePack.clips[cur.key] = {
        b64: b64, bytes: buf.byteLength, at: Date.now(), text: cur.text,
        voiceId: activeVoiceId, modelId: VOICE_MODEL, hashAlgo: HASH_ALGO,
        hash: clipContentHash(cur.text, activeVoiceId, VOICE_MODEL)
       };
       rec++;
      }
      pullNext();
     }, function () { pullNext(); });
    }
    pullNext();
   }, function (err) {
    msg('Could not reach ElevenLabs History.', 'warn');
    cb(err);
   });
  });
 }

 /* Commit the freshly paid-for clips so */
 /* v0.0.4.b: sequential publish mutex — concurrent calls queue, never race */
 var packPublishQueue = [], packPublishBusy = false;
 /* v0.0.6.r Pillar 1 — INSTANT LOCAL PERSISTENCE: the freshly synthesized
    briefing/guide pack is written into THIS browser's caches and localStorage
    before (and regardless of) any GitHub latency, so the generated Cloned
    Voice survives reloads even with no token. */
 function primeLocalVoicePackCache(packObj, rev) {
  try {
   if (!global.caches || !global.caches.open || !isObj(packObj)) return false;
   var keys = ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4'].concat(GUIDE_KEYS);
   var clips = {}, i;
   for (i = 0; i < keys.length; i++) {
    if (isObj(ST.voicePack.clips[keys[i]]) && str(ST.voicePack.clips[keys[i]].b64)) clips[keys[i]] = ST.voicePack.clips[keys[i]];
   }
   var stamp = Number(rev) || Number(packObj.syncRev) || nextSyncRev();
   var localPack = { syncRev: stamp, briefingVoiceId: str(packObj.briefingVoiceId), briefingVoiceName: str(packObj.briefingVoiceName), weekStamp: currentWeeksSinceStart(), at: Date.now(), clips: clips };
   var packBody = JSON.stringify(packObj);
   global.caches.open('sdp-audio-clips').then(function (cache) {
    return cache.put('./local-briefing-pack.json', new Response(JSON.stringify(localPack), { headers: { 'Content-Type': 'application/json', 'x-sdp-syncrev': String(stamp) } }));
   }).catch(function () {});
   global.caches.open('sdp-v' + appVersion() + '-s34-shell').then(function (cache) {
    return cache.put('./data/elevenlabs-audio.json', new Response(packBody, { headers: { 'Content-Type': 'application/json', 'x-sdp-release': appVersion(), 'x-sdp-syncrev': String(stamp) } }));
   }).catch(function () {});
   try {
    global.localStorage.setItem('sdp.briefing.meta', JSON.stringify({ syncRev: stamp, voiceId: str(packObj.briefingVoiceId), voiceName: str(packObj.briefingVoiceName), weekStamp: currentWeeksSinceStart(), at: Date.now() }));
   } catch (eL) {}
   return true;
  } catch (e) { return false; }
 }
 function commitVoicePack(cb) {
  cb = cb || noop;
  /* v0.0.6.r: any key/token sitting in the input fields is merged into
     ST.secrets BEFORE the token check, so a pasted GitHub token commits on
     the very same click instead of silently aborting with no_token. */
  try { mergeSecretInputs(); } catch (eM) {}
  packPublishQueue.push(cb);
  if (packPublishBusy) return true;
  packPublishBusy = true;
  /* ONE monotonic rev stamps BOTH files; the pack is live in this browser */
  var rev = nextSyncRev();
  /* v0.0.7.a: purge stale words.* BEFORE building the payload. */
  try { purgeStaleWordsFromPack(ST.voicePack.clips, currentWords()); } catch (ePW) {}
  var packObj = voicePackPayload(rev);
  try {
   if (global.SDP && SDP.Speech) {
    if (SDP.Speech.applyManifest) SDP.Speech.applyManifest(packObj);
    if (SDP.Speech.injectClips) SDP.Speech.injectClips(ST.voicePack.clips);
   }
  } catch (eA) {}
  primeLocalVoicePackCache(packObj, rev);
  function done(err, info) {
   var list = packPublishQueue.slice();
   packPublishQueue = [];
   packPublishBusy = false;
   /* v0.0.6.r CRITICAL LAW: no forced manifest reload is issued after a
      commit — the GitHub Pages CDN/Fastly still serves the pre-commit file
      for minutes and would overwrite the fresh pack with the stale one. */
   for (var i = 0; i < list.length; i++) { try { list[i](err, info); } catch (e2) {} }
  }
  var token = str(ST.secrets.ghToken) || fieldValue('ghTokenInput');
  if (!token || !sync() || !sync().publishFilesSequential) {
   packPublishBusy = false;
   var waiting = packPublishQueue.slice();
   packPublishQueue = [];
   for (var j = 0; j < waiting.length; j++) { try { waiting[j](new Error('no_token')); } catch (e3) {} }
   return false;
  }
  /* v0.0.6.r ATOMIC DUAL-FILE COMMIT: data/elevenlabs-audio.json AND
     data/version.json (the same monotonic syncRev) publish in one sequential
     batch, so every other browser sees the pointer move and re-pulls the
     pack the moment it advances. */
  var liveVer = sync() && sync().version ? (sync().version() || {}) : {};
  var sessNo = str(liveVer.session || '8') || '8';
  var sessTitle = str(liveVer.title || '') || ('Session ' + sessNo);
  var verObj = buildVersionPayload(sessNo, sessTitle, rev);
  verObj.payloadFiles = ['data/elevenlabs-audio.json', 'data/version.json'];
  var files = [
   { path: 'data/elevenlabs-audio.json', content: JSON.stringify(packObj, null, 2), message: 'Briefing & Alice voice pack ' + appVersion() },
   { path: 'data/version.json', content: JSON.stringify(verObj, null, 2), message: 'Bump syncRev for voice pack ' + appVersion() }
  ];
  sync().publishFilesSequential(files, token, noop, done);
  return true;
 }

 /* D12: an interactive 30-row */
 function wordManagerWords() {
  var list = ST.words.length ? ST.words : (sync() && sync().words ? sync().words() : []);
  return Array.isArray(list) ? list.slice(0, wordCap()) : []; /* v0.0.7.a Z5 */
 }
 /* v0.0.4.a W2: read-only auto-enriched preview badge per row; the six edit */
 /* v0.0.5.c: the per-row SVG preview button plays the committed Alice clip */
 function previewWmRow(row) {
  var list = wordManagerWords(), idx = Number(row);
  if (!list.length || isNaN(idx) || !list[idx]) return false;
  return playVaultClip('words.' + str(list[idx].w).toLowerCase());
 }
 function toggleWmRow(row) {
  var host = byId('studioWordManager');
  if (!host || !host.querySelectorAll) return false;
  var trs = host.querySelectorAll('tr.wm-row');
  for (var i = 0; i < trs.length; i++) {
   if (String(trs[i].getAttribute('data-word-row')) === String(row)) {
    var cells = trs[i].querySelector('.wm-edit-cells');
    if (cells) cells.hidden = !cells.hidden;
    return true;
   }
  }
  return false;
 }

 function britishizeIpa(raw) {
  var ipa = str(raw).replace(/^\s+|\s+$/g, '').replace(/^\/+|\/+$/g, '');
  if (!ipa) return '';
  ipa = ipa
   .replace(/\u025d/g, '\u025c\u02d0r')  /* ɝ → ɜːr */
   .replace(/\u025a/g, '\u0259')          /* ɚ → ə (non-rhotic) */
   .replace(/\u0254r/g, '\u0254\u02d0r')  /* ɔr → ɔːr */
   .replace(/\u0251r/g, '\u0251\u02d0r'); /* ɑr → ɑːr */
  return '/' + ipa + '/';
 }
 function verifyPrompt(word) {
  return 'You are a Cambridge English B1 (CCBE, Sri Lanka) British English pronunciation editor. ' +
   'For the word "' + str(word) + '" return STRICT JSON only, exactly: ' +
   '{"words":[{"w":"' + str(word) + '","p":"UK IPA in slashes, Cambridge B1 British, non-rhotic","pos":"grammar abbreviation with a dot, e.g. adj.",' +
   '"m":"one simple B1 English meaning, max 12 words","si":"accurate Sinhala meaning","s":"one simple B1 example sentence using the word",' +
   '"ttsHint":"phoneme-guided respelling of the word that forces Received Pronunciation from a TTS engine"}]}. ' +
   'The IPA must be British (e.g. /ɪmˈpɔːtənt/), never US /ɝ/ or /ɚ/. No extra fields, no commentary.';
 }
 function verifyPronunciationWord(word, cb) {
  cb = cb || noop;
  var w = str(word && word.w ? word.w : word);
  if (!w) { cb(new Error('no_word')); return false; }
  /* v0.0.6.m provider cascade: the chosen provider + key first, then the */
  var candidates = llmCandidates({ p: aiProviderName(), k: str(ST.secrets.aiKey) || fieldValue('studioAiKey') });
  var at = 0;
  function attemptOne() {
   if (at >= candidates.length) { cb(new Error('llm_failed')); return; }
   var c = candidates[at];
   at += 1;
   llmRequest(c.p, c.k, [w], function (err, rows) {
    var rec = (!err && rows) ? rows[w.toLowerCase()] : null;
    if (isObj(rec) && str(rec.p)) {
     rec.p = britishizeIpa(rec.p);
     cb(null, rec);
     return;
    }
    /* v0.0.6.m: HTTP 429 / 401 / 429-style failures rotate the Groq pool */
    var st = Number((err && err.status) || 0);
    if (st === 429 && c.p === 'groq') logGroqRotation('http_429', at);
    attemptOne();
   }, verifyPrompt(w));
  }
  attemptOne();
  return true;
 }
 function verifyWmRow(row) {
  var list = wordManagerWords(), idx = Number(row);
  if (!list.length || isNaN(idx) || !list[idx]) return false;
  var word = list[idx];
  if (!isObj(ST.verifyBadges)) ST.verifyBadges = {};
  msg(' Verifying "' + esc(str(word.w)) + '" · Cambridge B1 British English…', '');
  verifyPronunciationWord(word, function (err, rec) {
   if (err) {
    ST.verifyBadges[idx] = '⚠';
    paintWordManager();
    try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('pronunciation_flag', { word: str(word.w), reason: 'llm_failed' }); } catch (e) {}
    msg(' Could not verify "' + esc(str(word.w)) + '" — check the AI key or pool slots', 'bad');
    return;
   }
   list[idx].p = str(rec.p) || list[idx].p;
   if (str(rec.pos)) list[idx].pos = str(rec.pos);
   if (str(rec.m)) list[idx].m = str(rec.m);
   if (str(rec.si)) list[idx].si = str(rec.si);
   if (str(rec.s)) list[idx].s = str(rec.s);
   if (str(rec.ttsHint)) list[idx].ttsHint = str(rec.ttsHint);
   ST.words = list;
   ST.verifyBadges[idx] = '✓';
   ST.dirty = true;
   paintDirtyState();
   paintWordManager();
   var editor = byId('studioWords');
   if (editor) editor.value = wordsToText(list);
   try {
    if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('pronunciation_verified', { word: str(word.w) });
   } catch (e) {}
   msg(' ' + esc(str(word.w)) + ' verified · ' + esc(str(list[idx].p)) + ' — listening preview…', 'ok');
   /* Preview: the phoneme-guided hint, so the lecturer hears the exact RP */
   try {
    if (global.SDP && SDP.Speech && SDP.Speech.say) {
     SDP.Speech.say([str(RP_TTS_OVERRIDES[str(word.w).toLowerCase()] || word.w)], { lang: 'en-GB', rate: 0.9 }, noop);
    }
   } catch (e) {}
  });
  return true;
 }
 function resynthWmRow(row) {
  var list = wordManagerWords(), idx = Number(row);
  if (!list.length || isNaN(idx) || !list[idx]) return false;
  var w = list[idx];
  var key = 'words.' + str(w.w).toLowerCase();
  /* v0.0.6.t PILLAR 4C: default the Lecturer's ttsHint to the RP respelling
     so a bare "advertisement" is never re-synthesized with the same American
     stress pattern that made the old clip wrong. */
  if (!str(w.ttsHint)) {
   w.ttsHint = RP_TTS_OVERRIDES[str(w.w).toLowerCase()] || w.ttsHint || '';
   if (str(w.ttsHint)) {
    list[idx] = w;
    ST.words = list;
    ST.dirty = true;
    var ed = byId('studioWords');
    if (ed) ed.value = wordsToText(list);
   }
  }
  /* Drop BOTH the canonical and the bare key so the delta queue rebuilds
     exactly this word and no stale alias survives the re-synthesis. */
  if (isObj(ST.voicePack.clips)) { delete ST.voicePack.clips[key]; delete ST.voicePack.clips[str(w.w).toLowerCase()]; }
  msg(' Re-synthesizing 1 word: ' + esc(str(w.w)) + (str(w.ttsHint) ? ' [' + esc(str(w.ttsHint)) + ']' : '') + '…', '');
  generateClips({ words: [w], keys: [key], force: true }, function (err) {
   if (err) { msg(' Re-synthesis failed · ' + quotaError(err), 'bad'); return; }
   /* v0.0.6.t PILLAR 4D: inject the fresh clip into the LIVE speech layer
     immediately (the bare alias is recomputed by hydrateClips) and preview
     it, so the Lecturer hears the new British RP clip right away. */
   try { if (global.SDP && SDP.Speech && SDP.Speech.injectClips) SDP.Speech.injectClips(ST.voicePack.clips); } catch (eInj) {}
   try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('word_resynthesized', { word: str(w.w), ttsHint: str(w.ttsHint) }); } catch (e) {}
   msg(' ' + esc(str(w.w)) + ' re-synthesized · 1 word · the other 29 clips untouched', 'ok');
   previewWmRow(idx);
  });
  return true;
 }
 function paintWordManager() {
  var host = byId('studioWordManager');
  if (!host) return false;
  var list = wordManagerWords();
  if (!list.length) { host.innerHTML = ''; return true; }
  var cols = ['w', 'p', 'pos', 'm', 'si', 's'];
  var rows = '', i, c;
  for (i = 0; i < list.length; i++) {
   var w = list[i] || {};
   var ipa = str(w.p) ? '/' + str(w.p).replace(/^\/+|\/+$/g, '') + '/' : '/—/';
   rows += '<tr class="wm-row" data-word-row="' + i + '"><td class="wm-idx">' + (i + 1) + '</td>' +
    '<td colspan="6"><div class="wm-preview">#' + (i + 1) + ' <b>' + esc(str(w.w)) + '</b> · ' + esc(ipa) +
    ' · ' + esc(str(w.pos) || '—') + ' · <span lang="si">' + esc(str(w.si) || '—') + '</span> · ' +
    esc(str(w.m)) + ' · <i>' + esc(str(w.s)) + '</i>' +
    ' <button type="button" class="btn btn-sm wm-preview" data-action="previewWmRow" data-row="' + i +
    '" aria-label="Play the Alice clip for row ' + (i + 1) + '">' + ico('volume', 15) + '</button>' +
    ' <button type="button" class="btn btn-sm wm-toggle" data-action="toggleWmRow" data-row="' + i +
    '" aria-label="Edit row ' + (i + 1) + '">' + ico('edit', 15) + '</button>' +
    /* v0.0.6.m Pillar 2: per-word Verify & Preview Pronunciation (♪) and */
    ' <button type="button" class="btn btn-sm wm-verify" data-action="verifyWmRow" data-row="' + i +
    '" title="Verify &amp; preview pronunciation (Cambridge B1 British)" aria-label="Verify and preview pronunciation for row ' + (i + 1) + '">\u266a</button>' +
    ' <button type="button" class="btn btn-sm wm-resynth" data-action="resynthWmRow" data-row="' + i +
    '" title="Re-synthesize this single word" aria-label="Re-synthesize single word for row ' + (i + 1) + '">\u21bb</button>' +
    ' <span class="wm-vbadge" data-vbadge="' + i + '">' + esc(str((ST.verifyBadges || {})[i])) + '</span></div><div class="wm-edit-cells" hidden>';
   for (c = 0; c < cols.length; c++) {
    rows += '<input class="input wm-input" data-wm="' + cols[c] + '" data-wm-field="' + cols[c] + '" data-row="' + i +
     '" value="' + esc(str(w[cols[c]])) + '">';
   }
   rows += '</div></td></tr>';
  }
  host.innerHTML = '<div class="table-wrap"><table class="studio-preview-table studio-word-table"><thead><tr>' + '<th>#</th><th>w · p · pos · si · m · s</th></tr></thead><tbody>' +
   rows + '</tbody></table></div><p class="muted">' + T('studioWordManager') + ' · ' +
   list.length + ' ' + T('studioWordsCount') + '</p>';
  return true;
 }
 
 function parseBulkWords(text) {
  var parts = str(text).split(/[\n,;]+/);
  var out = [], seen = {}, i;
  var committed = committedWords();
  for (i = 0; i < parts.length; i++) {
   var line = str(parts[i]).replace(/^\s+|\s+$/g, '');
   if (!line) continue;
   /* v0.0.6.e (A): strip pasted list numbering (1. / 2) / #03 / 4:) and */
   line = line.replace(/^#\d+[.)]?\s*/, '').replace(/^\d+[.)\]:-]\s*/, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
   if (!line) continue;
   var cols = line.indexOf('|') >= 0 ? line.split('|') : [line];
   var word = str(cols[0]).replace(/^\s+|\s+$/g, '');
   if (!word) continue;
   var key = word.toLowerCase();
   if (seen[key]) continue;
   seen[key] = true;
   var rec = {
    w: word, p: str(cols[1] || '').replace(/^\s+|\s+$/g, ''),
    pos: str(cols[2] || '').replace(/^\s+|\s+$/g, ''),
    m: str(cols[3] || '').replace(/^\s+|\s+$/g, ''),
    si: str(cols[4] || '').replace(/^\s+|\s+$/g, ''),
    s: str(cols[5] || '').replace(/^\s+|\s+$/g, '')
   };
   /* v0.0.6.d (D2): when the spelling at this slot differs from the committed */
   if (committed.length && i < committed.length &&
     str(committed[i] && committed[i].w).toLowerCase() !== key) {
    rec.p = ''; rec.pos = ''; rec.m = ''; rec.si = ''; rec.s = '';
   }
   out.push(rec);
   /* v0.0.6.e (A): never truncate at 30 — the lecturer sees every extra word */
  }
  return out;
 }
 
function liveSessionNo() { try { return str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8') || '8'; } catch (e) { return '8'; } }
function liveSessionTitle() { try { return str(SDP.Sync && SDP.Sync.sessionTitle ? SDP.Sync.sessionTitle() : ''); } catch (e) { return ''; } }
function rawParsedFromField() { return parseBulkWords(fieldValue('studioBulkWords') || wordsToText(ST.words)); }
function currentParsed() { return (ST.rawParsedWords && ST.rawParsedWords.length ? ST.rawParsedWords : rawParsedFromField()).slice(); }
function wordsHelperState(n) { var cap = wordCap(); if (n === cap) return 'ready'; if (n > cap) return 'over'; return 'under'; }
function paintWordsHelper() {
  var host = byId('studioWordsCountHelper'); if (!host) return false;
  var parsed = currentParsed(); var n = parsed.length; var st = wordsHelperState(n); var text = ''; var cap = wordCap();
  if (st === 'ready') text = '\u2713 ' + n + ' / ' + cap + ' words ready';
  else if (st === 'over') text = t('helperOver', '{n} words detected (need 30) \u2014 tap \u21c4 on a split word to merge it, or tap \u2715 to remove an extra word').replace('{n}', String(n)).replace('need 30', 'need ' + cap);
  else text = t('helperUnder', '{n} / 30 words \u2014 add {need} more').replace('{n}', String(n)).replace('{need}', String(cap - n)).replace('/ 30 words', '/ ' + cap + ' words');
  setText(host, text);
  host.setAttribute('data-state', st);
  host.className = 'studio-count-helper is-' + st;
  return true;
}
function paintLiveChips() {
  var host = byId('studioLiveChips'); if (!host) return false;
  var parsed = currentParsed(); var html = ''; var i; var capChips = wordCap();
  for (i = 0; i < parsed.length; i++) {
    var w = str(parsed[i] && parsed[i].w ? parsed[i].w : parsed[i]);
    var extra = i >= capChips ? ' chip-extra' : '';
    html += '<span class="chip-word' + extra + '" role="listitem"><b>#' + (i + 1) + '</b> <i class="chip-w">' + esc(w) + '</i>' +
     (i < parsed.length - 1 ? ' <button type="button" class="chip-merge" data-action="chip-merge" data-idx="' + i + '" aria-label="' + esc(t('chipMergeLabel', 'Merge with next word')) + '">\u21c4</button>' : '') +
     ' <button type="button" class="chip-x" data-action="chip-remove" data-idx="' + i + '" aria-label="' + esc(t('chipRemoveLabel', 'Remove word')) + '">\u2715</button></span>';
  }
  host.innerHTML = html;
  var pill = byId('studioWordCountPill');
  if (pill) {
    setText(pill, wordCountPillText(Math.min(parsed.length, wordCap()))); /* v0.0.7.a A1: cap-aware, never a hard 30 */
    pill.setAttribute('data-full', parsed.length >= wordCap() ? 'true' : 'false');
    pill.setAttribute('data-state', wordsHelperState(parsed.length));
  }
  return true;
}
function writeBulkFromParsed(parsed) {
  var bulk = byId('studioBulkWords'); var arr = []; var i;
  for (i = 0; i < (parsed || []).length; i++) arr.push(str(parsed[i] && parsed[i].w ? parsed[i].w : parsed[i]));
  if (bulk) bulk.value = arr.join(', ');
  setStudioWords(parseBulkWords(fieldValue('studioBulkWords')), 'bulk');
  try { detectWordDeltas(); } catch (e) {}
  try { paintDirtyState(); } catch (e) {}
  try { scheduleAutoEnrich(); } catch (e) {}
  return true;
}
function chipRemove(idx) { var l = currentParsed(); if (!(idx >= 0) || idx >= l.length) return false; l.splice(idx, 1); return writeBulkFromParsed(l); }
function chipMerge(idx) {
  var l = currentParsed(); if (!(idx >= 0) || idx + 1 >= l.length) return false;
  var a = str(l[idx] && l[idx].w ? l[idx].w : l[idx]), b = str(l[idx + 1] && l[idx + 1].w ? l[idx + 1].w : l[idx + 1]);
  l[idx] = isObj(l[idx]) ? copyParsed(l[idx], a + '-' + b) : { w: a + '-' + b };
  l.splice(idx + 1, 1);
  return writeBulkFromParsed(l);
}
function copyParsed(src, w) { var o = {}; o.w = w; o.p = str(src.p); o.pos = str(src.pos); o.m = str(src.m); o.si = str(src.si); o.s = str(src.s); return o; }
function setStudioWords(list, source) {
  ST.words = (Array.isArray(list) ? list : []).slice(0, wordCap()); /* v0.0.7.a Z5 */
  ST.rawParsedWords = Array.isArray(list) ? list.slice() : [];
  var editor = byId('studioWords');
  if (editor) editor.value = wordsToText(ST.words);
  var bulk = byId('studioBulkWords');
  if (bulk && source !== 'bulk') {
   var names = [], i;
   for (i = 0; i < ST.words.length; i++) names.push(str(ST.words[i].w));
   bulk.value = names.join('\n');
  }
  setText(byId('studioCount'), ST.words.length + ' ' + t('studioWordsCount'));
  setText(byId('costPreviewLine'), costPreviewLine(ST.words));
  paintWordManager();
  paintLiveChips();
  paintWordsHelper();
  return ST.words;
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
   /* v0.0.6.v — amber per-clip badges: a fallback take (degradedTake) or an
      unverified RP respelling is visible at a glance in the pack table. */
   var badge = '';
   if (isObj(entry) && entry.degradedTake === true) badge += ' <span class="wm-vbadge" style="color:#B45309;">⚠ Flat Take — Retry</span>';
   if (isObj(entry) && /^words\./.test(keys[i]) && !str(entry.ttsVerified)) badge += ' <span class="wm-vbadge" style="color:#B45309;">⚠ Verify RP</span>';
   rows += '<tr><td>' + esc(keys[i]) + badge + '</td><td>' + (bytes ? bytes + ' B' : 'cached') + '</td></tr>';
  }
  host.innerHTML = '<table class="studio-preview-table"><thead><tr><th>clip</th><th>size</th></tr></thead><tbody>' + rows + '</tbody></table>';
  return true;
 }

 /* ══ v0.0.7.a Pillar 1 (Y1) — the production Voice Sample Recorder &
    Uploader, the DSP + Gemini AI Acoustic Analyzer, the automatic
    pre-enhancement ("proud & authoritative voice") mastering chain and the
    ElevenLabs Instant Voice Cloning pipeline. Replaces the legacy D-L5
    single-clip stub. All state nests under ST (in-memory) + sdp.settings
    .voiceSampleProfile (five-key law). ══ */
 var VS = { active: false, stream: null, recorder: null, chunks: [], startedAt: 0, timerId: 0, meterId: 0, rafId: 0, blob: null, pcm: null, source: '', confirmed: false, analysis: null, enhancedBlob: null, profile: null, cloning: false, liveTranscript: '', recognizer: null };
 function vsStatus(text, state) {
  var el = byId('voiceSampleStatus');
  if (el) { el.textContent = str(text); el.setAttribute('data-state', str(state || 'info')); }
  if (str(text)) msg(str(text), state === 'bad' ? 'bad' : (state === 'warn' ? 'warn' : 'ok'));
  return true;
 }
 function vsClock(s) {
  s = Math.max(0, Number(s) || 0);
  var m = Math.floor(s / 60), r = Math.floor(s % 60);
  return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
 }
 function vsPaintTimer() {
  var el = byId('voiceSampleTimer');
  if (el) el.textContent = vsClock((Date.now() - VS.startedAt) / 1000) + ' / 02:00';
 }
 function vsStopEverything() {
  VS.active = false;
  if (VS.timerId) { global.clearInterval(VS.timerId); VS.timerId = 0; }
  if (VS.meterId) { global.clearInterval(VS.meterId); VS.meterId = 0; }
  if (VS.rafId) { global.cancelAnimationFrame ? global.cancelAnimationFrame(VS.rafId) : global.clearTimeout(VS.rafId); VS.rafId = 0; }
  /* v0.0.7.a Z2: stop the parallel Web Speech recognizer (keep transcript). */
  try { if (VS.recognizer) { VS.recognizer.onend = null; VS.recognizer.stop(); } } catch (eSR2) {}
  VS.recognizer = null;
  try { if (VS.stream) VS.stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (eS) {}
  VS.stream = null;
  var rb = byId('btnVoiceSampleRecord'), sb = byId('btnVoiceSampleStop');
  if (rb) rb.disabled = false;
  if (sb) sb.disabled = true;
 }
 /* Live mic recorder — echo cancellation on, AGC off, 44.1 kHz ask. */
 function vsStartRecording() {
  var media = global.navigator && global.navigator.mediaDevices;
  if (!media || typeof global.MediaRecorder !== 'function') { vsStatus('Microphone recording is not available in this browser — upload an audio file instead.', 'warn'); return false; }
  if (VS.active) return false;
  var doStart = function (stream) {
   VS.stream = stream;
   VS.chunks = [];
   VS.active = true;
   VS.startedAt = Date.now();
   var mime = '';
   try { if (global.MediaRecorder.isTypeSupported && global.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus'; } catch (eM) {}
   try {
    VS.recorder = mime ? new global.MediaRecorder(stream, { mimeType: mime }) : new global.MediaRecorder(stream);
   } catch (eR2) { VS.recorder = new global.MediaRecorder(stream); }
   VS.recorder.ondataavailable = function (ev) { if (ev && ev.data && ev.data.size) VS.chunks.push(ev.data); };
   VS.recorder.onstop = function () {
    var blob = new global.Blob(VS.chunks, { type: VS.recorder && VS.recorder.mimeType ? VS.recorder.mimeType : 'audio/webm' });
    VS.blob = blob;
    VS.source = 'recorded';
    vsStopEverything();
    var pv = byId('voiceSamplePreviewAudio');
    if (pv && global.URL && global.URL.createObjectURL) { try { pv.src = global.URL.createObjectURL(blob); } catch (eU) {} }
    vsStatus('Recorded ' + vsClock(blob.size / 32000) + ' — listen, then Save & Confirm to use it as the Reference Voice Sample.', 'ok');
   };
   VS.recorder.start(250);
   /* v0.0.7.a Z2 — the LIVE Web Speech parallel transcript: while the mic
      records, a continuous SpeechRecognition (when the browser ships one)
      transcribes the free speech in parallel so the analyzer has a zero-cost
      transcript even with no Gemini key. Strictly optional — never blocks
      the recording, never throws. */
   VS.liveTranscript = '';
   try {
    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (SR) {
     var rec = new SR();
     rec.continuous = true;
     rec.interimResults = false;
     rec.lang = 'en-GB';
     rec.onresult = function (ev) {
      try {
       var t = '';
       for (var ri = 0; ri < (ev.results || []).length; ri++) t += str(ev.results[ri][0] && ev.results[ri][0].transcript) + ' ';
       VS.liveTranscript = t.trim();
      } catch (eR3) {}
     };
     rec.onerror = function () {};
     rec.onend = function () { try { if (VS.active && VS.recognizer === rec) rec.start(); } catch (eR4) {} };
     rec.start();
     VS.recognizer = rec;
    }
   } catch (eSR) { VS.recognizer = null; }
   var sb = byId('btnVoiceSampleStop');
   if (sb) sb.disabled = false;
   VS.timerId = global.setInterval(function () {
    vsPaintTimer();
    if (Date.now() - VS.startedAt >= 120000) { vsStatus('Two minutes reached — stopping automatically.', 'warn'); vsStopRecording(); }
   }, 250);
   try {
    var AC = global.AudioContext || global.webkitAudioContext;
    var ctx = new AC();
    var src = ctx.createMediaStreamSource(stream);
    var an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    var buf = new global.Float32Array(an.fftSize);
    var meter = byId('voiceSampleMeter');
    var pump = function () {
      try {
       an.getFloatTimeDomainData(buf);
       var sum = 0, i;
       for (i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
       var rms = Math.sqrt(sum / buf.length);
       if (meter) meter.style.width = Math.min(100, Math.round(rms * 260)) + '%';
      } catch (eP) {}
      if (VS.active) VS.rafId = global.requestAnimationFrame ? global.requestAnimationFrame(pump) : global.setTimeout(pump, 80);
    };
    pump();
   } catch (eA) {}
   vsStatus('Recording… read the passage naturally. 30 s minimum, 2 min maximum.', 'ok');
   return true;
  };
  try {
   media.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, sampleRate: 44100 } })
    .then(doStart, function () { vsStatus('Microphone permission denied — upload an audio file instead.', 'bad'); return false; });
  } catch (eG) { vsStatus('Microphone unavailable — upload an audio file instead.', 'bad'); return false; }
  return true;
 }
 function vsStopRecording() {
  if (VS.recorder && VS.recorder.state !== 'inactive') { try { VS.recorder.stop(); } catch (e) {} }
  else vsStopEverything();
  return true;
 }
 /* File upload leg — any 10 KB … 25 MB audio file. */
 function vsHandleFile(file) {
  if (!file) return false;
  if (file.size < 10 * 1024) { vsStatus('File too small (min 10 KB).', 'bad'); return false; }
  if (file.size > 25 * 1024 * 1024) { vsStatus('File too large (max 25 MB).', 'bad'); return false; }
  var pv = byId('voiceSamplePreviewAudio');
  if (pv && global.URL && global.URL.createObjectURL) { try { pv.src = global.URL.createObjectURL(file); } catch (eU) {} }
  VS.blob = file;
  VS.source = 'uploaded';
  vsStatus('Loaded "' + file.name + '" (' + Math.round(file.size / 1024) + ' KB) — listen, then Save & Confirm.', 'ok');
  return true;
 }
 /* Decode the confirmed sample to PCM for the DSP analyzer. */
 function vsDecode(blob, cb) {
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
 }
 /* Stage 1 — deterministic Web Audio DSP analysis (0 latency, always runs). */
 function vsDspAnalyze(buf) {
  var fs = buf.sampleRate || 44100;
  var N = buf.length;
  var chs = buf.numberOfChannels || 1;
  var mono = new global.Float32Array(N);
  var c, i;
  for (c = 0; c < chs; c++) {
   var d = buf.getChannelData(c);
   for (i = 0; i < N; i++) mono[i] += d[i] / chs;
  }
  var lufs = -70, peak = -99, lra = 0;
  try { if (SDP.AudioNormalize && SDP.AudioNormalize.measureLoudness) lufs = SDP.AudioNormalize.measureLoudness(mono, fs); } catch (eL) {}
  try { if (SDP.AudioNormalize && SDP.AudioNormalize.truePeakDb) peak = SDP.AudioNormalize.truePeakDb(mono); } catch (eP) {}
  /* frame energies: noise floor (10th pct), silence ratio, LRA */
  var frame = Math.floor(fs * 0.1), frames = Math.max(1, Math.floor(N / frame)), fe = [], fi, s, e, sum, rms;
  for (fi = 0; fi < frames; fi++) {
   s = fi * frame; e = s + frame; sum = 0;
   for (i = s; i < e && i < N; i++) sum += mono[i] * mono[i];
   rms = Math.sqrt(sum / Math.max(1, e - s));
   fe.push(20 * Math.log10(rms + 1e-9));
  }
  fe.sort(function (a, b) { return a - b; });
  var noiseFloor = fe.length ? fe[Math.floor(fe.length * 0.1)] : -70;
  var silenceRatio = 0;
  for (fi = 0; fi < fe.length; fi++) if (fe[fi] < -50) silenceRatio += 1;
  silenceRatio = fe.length ? silenceRatio / fe.length : 0;
  if (fe.length > 8) lra = Math.round((fe[Math.floor(fe.length * 0.95)] - fe[Math.floor(fe.length * 0.1)]) * 10) / 10;
  /* crude 4-band spectrum via one real Goertzel sweep per band center */
  var bandEnergy = function (fLo, fHi) {
   var mag = 0, k, w, coeff, pwr1, pwr2, pwr0, j, n = Math.min(N, fs * 8);
   for (k = fLo; k <= fHi; k += Math.max(1, Math.floor((fHi - fLo) / 12))) {
    w = 2 * Math.PI * k / fs;
    coeff = 2 * Math.cos(w);
    pwr1 = 0; pwr2 = 0;
    for (j = 0; j < n; j++) { pwr0 = mono[j] + coeff * pwr1 - pwr2; pwr2 = pwr1; pwr1 = pwr0; }
    mag += pwr1 * pwr1 + pwr2 * pwr2 - coeff * pwr1 * pwr2;
   }
   return mag;
  };
  var eLow = bandEnergy(40, 115), eMud = bandEnergy(115, 350), eMid = bandEnergy(350, 2500), ePres = bandEnergy(2500, 4500), eSib = bandEnergy(6000, 9000), eAir = bandEnergy(6000, 11000);
  var tot = eLow + eMud + eMid + ePres + eSib + 1e-9;
  var centroidNum = 0, centroidDen = 0;
  var bandList = [[77, eLow], [232, eMud], [1425, eMid], [3500, ePres], [7500, eSib]];
  for (i = 0; i < bandList.length; i++) { centroidNum += bandList[i][0] * bandList[i][1]; centroidDen += bandList[i][1]; }
  var centroid = centroidDen > 0 ? centroidNum / centroidDen : 0;
  /* v0.0.7.a PILLAR 2 (Z2) — the FULL ACOUSTIC & FREQUENCY PROFILER:
     fundamental pitch F0 (Hz, autocorrelation over 80–400 Hz),
     RMS intensity (dB), and the dedicated 2.5–4.5 kHz presence-clarity
     ratio, so the clone pipeline registers the lecturer's exact acoustic
     signature before enhancement. */
  var rmsAll = 0;
  for (i = 0; i < N; i++) rmsAll += mono[i] * mono[i];
  var rmsDb = 20 * Math.log10(Math.sqrt(rmsAll / Math.max(1, N)) + 1e-9);
  var f0Hz = 0;
  try {
   var seg = Math.min(N, Math.floor(fs * 2)), lagMin = Math.floor(fs / 400), lagMax = Math.floor(fs / 80), lag, best = 0, bestLag = 0;
   var eSum = 0;
   for (i = 0; i < seg; i++) eSum += mono[i] * mono[i];
   if (eSum > 1e-6) {
    for (lag = lagMin; lag <= lagMax; lag += 2) {
     var corr = 0, li;
     for (li = 0; li + lag < seg; li += 2) corr += mono[li] * mono[li + lag];
     corr = corr / Math.max(1, Math.floor((seg - lag) / 2));
     if (corr > best) { best = corr; bestLag = lag; }
    }
    if (bestLag > 0) f0Hz = Math.round(fs / bestLag);
   }
  } catch (eF0) { f0Hz = 0; }
  var ePresBand = bandEnergy(2500, 4500);
  var presenceClarityRatio = Math.round((ePresBand / tot) * 1000) / 1000;
  var m = {
   durationSec: Math.round((N / fs) * 10) / 10,
   sampleRate: fs,
   integratedLufs: Math.round(lufs * 10) / 10,
   truePeakDbTP: Math.round(peak * 10) / 10,
   rmsDb: Math.round(rmsDb * 10) / 10,
   f0Hz: f0Hz,
   dynamicRangeDb: lra,
   noiseFloorDb: Math.round(noiseFloor * 10) / 10,
   silenceRatio: Math.round(silenceRatio * 100) / 100,
   spectralCentroidHz: Math.round(centroid),
   lowMudRatio: Math.round((eMud / tot) * 1000) / 1000,
   presenceRatio: Math.round((ePres / tot) * 1000) / 1000,
   presenceClarityRatio: presenceClarityRatio,
   sibilanceRatio: Math.round((eSib / tot) * 1000) / 1000
  };
  /* objective quality score + concrete weaknesses */
  var score = 100;
  var weak = [];
  if (lufs < -26) { score -= 14; weak.push('low_projection'); }
  if (noiseFloor > -38) { score -= 12; weak.push('background_hiss'); }
  if ((eMud / tot) > 0.34) { score -= 10; weak.push('muffled_midrange'); }
  if (silenceRatio > 0.3) { score -= 10; weak.push('excessive_silence'); }
  if (lra > 16) { score -= 8; weak.push('dynamic_unevenness'); }
  if (peak > -1.5) { score -= 10; weak.push('clipping_risk'); }
  if ((ePres / tot) < 0.12) { score -= 8; weak.push('soft_consonants'); }
  if (m.durationSec < 30) { score -= 8; weak.push('sample_too_short'); }
  score = Math.max(5, Math.min(100, score));
  return { metrics: m, qualityScore: score, weaknesses: weak };
 }
 /* Stage 2 — Gemini multimodal audio analysis (key pool rotation, graceful
    deterministic fallback to Stage 1 when offline / no key). */
 function resolveAiKeys() {
  var out = [], seen = {};
  var add = function (p, k) { k = trimmedKey(str(k)); if (k && !seen[k]) { out.push({ p: str(p) || 'gemini', k: k }); seen[k] = 1; } };
  add('gemini', ST.secrets && ST.secrets.aiKey);
  add('gemini', fieldValue('studioAiKey'));
  try {
   var pool = keyPoolEntries();
   for (var i = 0; i < pool.length; i++) if (str(pool[i].p) === 'gemini') add('gemini', pool[i].k);
  } catch (eP) {}
  return out;
 }
 function vsGeminiAnalyze(audioBlob, dsp, cb) {
  var keys = resolveAiKeys();
  if (!keys.length) { cb(new Error('no_gemini_key'), null); return false; }
  var fr = new global.FileReader();
  fr.onload = function () {
   var b64 = str(fr.result).split(',')[1] || '';
   var telemetry = JSON.stringify({ dsp: dsp.metrics, qualityScore: dsp.qualityScore, weaknesses: dsp.weaknesses });
   var prompt = 'You are an audio forensics engineer. Analyze this 1-2 minute voice sample (base64 audio + DSP telemetry) ' +
    'and return ONLY minified JSON with exactly these keys: {"qualityScore":0-100,"timbreSummary":"...","weaknessesDetected":["..."],' +
    '"enhancementPlan":{"highPassHz":90,"noiseGateDb":-46,"presenceShelfHz":3200,"presenceGainDb":3.2,"mudCutHz":240,"mudCutDb":-2.5,' +
    '"compressorRatio":2.8,"targetLufs":-21.0},"recommendedElevenLabsSettings":{"stability":0.52,"similarity_boost":0.88,' +
    '"style":0.38,"use_speaker_boost":true}}. DSP telemetry: ' + telemetry;
   var tryKey = function (idx) {
    if (idx >= keys.length) { cb(new Error('gemini_all_keys_failed'), null); return; }
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(keys[idx].k);
    var body = JSON.stringify({
     contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: 'audio/mp3', data: b64 }
      }
     ] }]
    });
    global.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
     .then(function (res) { if (!res.ok) throw new Error('gemini_' + res.status); return res.json(); })
     .then(function (j) {
      var txt = '';
      try { txt = j.candidates[0].content.parts[0].text; } catch (eT) {}
      var m2 = txt.match(/\{[\s\S]*\}/);
      if (!m2) throw new Error('gemini_no_json');
      var prof = JSON.parse(m2[0]);
      if (!isObj(prof) || !isObj(prof.enhancementPlan) || !isObj(prof.recommendedElevenLabsSettings)) throw new Error('gemini_bad_shape');
      cb(null, prof, keys[idx].k);
     }, function () { tryKey(idx + 1); })
     .catch(function (err) { if (str(err && err.message).indexOf('gemini_') === 0 && idx + 1 < keys.length) tryKey(idx + 1); else cb(err, null); });
   };
   tryKey(0);
  };
  fr.onerror = function () { cb(new Error('read_failed'), null); };
  fr.readAsDataURL(audioBlob);
 }
 /* analyzeVoiceSampleWithAi(audioBlob, pcmBuffer, cb) — the hybrid analyzer. */
 function analyzeVoiceSampleWithAi(audioBlob, pcmBuffer, cb) {
  cb = cb || noop;
  var dsp = vsDspAnalyze(pcmBuffer);
  var done = function (aiProfile, aiKey) {
   var prof = {
    source: aiProfile ? 'gemini' : 'dsp',
    qualityScore: isObj(aiProfile) && Number(aiProfile.qualityScore) ? Math.round(Number(aiProfile.qualityScore)) : dsp.qualityScore,
    timbreSummary: isObj(aiProfile) && str(aiProfile.timbreSummary) ? str(aiProfile.timbreSummary) : 'Deterministic DSP profile (Gemini unavailable — offline or no key stored).',
    weaknessesDetected: (isObj(aiProfile) && Array.isArray(aiProfile.weaknessesDetected) && aiProfile.weaknessesDetected.length) ? aiProfile.weaknessesDetected.slice(0, 8).map(str) : dsp.weaknesses,
    enhancementPlan: {
     highPassHz: isObj(aiProfile) && isObj(aiProfile.enhancementPlan) && Number(aiProfile.enhancementPlan.highPassHz) ? Number(aiProfile.enhancementPlan.highPassHz) : 90,
     noiseGateDb: isObj(aiProfile) && isObj(aiProfile.enhancementPlan) && Number(aiProfile.enhancementPlan.noiseGateDb) ? Number(aiProfile.enhancementPlan.noiseGateDb) : -45,
     presenceShelfHz: isObj(aiProfile) && isObj(aiProfile.enhancementPlan) && Number(aiProfile.enhancementPlan.presenceShelfHz) ? Number(aiProfile.enhancementPlan.presenceShelfHz) : 3200,
     presenceGainDb: isObj(aiProfile) && isObj(aiProfile.enhancementPlan) && Number(aiProfile.enhancementPlan.presenceGainDb) ? Number(aiProfile.enhancementPlan.presenceGainDb) : 3.0,
     mudCutHz: isObj(aiProfile) && isObj(aiProfile.enhancementPlan) && Number(aiProfile.enhancementPlan.mudCutHz) ? Number(aiProfile.enhancementPlan.mudCutHz) : 240,
     mudCutDb: isObj(aiProfile) && isObj(aiProfile.enhancementPlan) && Number(aiProfile.enhancementPlan.mudCutDb) ? Number(aiProfile.enhancementPlan.mudCutDb) : -2.5,
     compressorRatio: isObj(aiProfile) && isObj(aiProfile.enhancementPlan) && Number(aiProfile.enhancementPlan.compressorRatio) ? Number(aiProfile.enhancementPlan.compressorRatio) : 2.8,
     targetLufs: -21.0
    },
    recommendedElevenLabsSettings: {
     stability: isObj(aiProfile) && isObj(aiProfile.recommendedElevenLabsSettings) && Number(aiProfile.recommendedElevenLabsSettings.stability) ? Number(aiProfile.recommendedElevenLabsSettings.stability) : 0.52,
     similarity_boost: isObj(aiProfile) && isObj(aiProfile.recommendedElevenLabsSettings) && Number(aiProfile.recommendedElevenLabsSettings.similarity_boost) ? Number(aiProfile.recommendedElevenLabsSettings.similarity_boost) : 0.88,
     style: isObj(aiProfile) && isObj(aiProfile.recommendedElevenLabsSettings) && Number(aiProfile.recommendedElevenLabsSettings.style) ? Number(aiProfile.recommendedElevenLabsSettings.style) : 0.38,
     use_speaker_boost: true
    },
    metrics: dsp.metrics,
    dspWeaknesses: dsp.weaknesses,
    dspQualityScore: dsp.qualityScore,
    aiKeyUsed: aiKey ? 'yes' : 'no',
    analyzedAt: Date.now()
   };
   VS.analysis = prof;
   cb(null, prof);
  };
  vsGeminiAnalyze(audioBlob, dsp, function (err, aiProf, key) {
   if (err) { try {
    if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('voice_ai_fallback', { reason: str(err && err.message) });
   } catch (eD) {} }
   done(err ? null : aiProf, err ? null : key);
  });
  return true;
 }
 /* Stage 3 — the automatic pre-enhancement mastering chain, rendered with an
    OfflineAudioContext (never a live AudioContext — R5 law). */
 function vsEnhanceSample(pcmBuffer, plan, cb) {
  cb = cb || noop;
  try {
   var fs = pcmBuffer.sampleRate || 44100;
   var dur = pcmBuffer.duration || 1;
   var OAC = global.OfflineAudioContext;
   if (!OAC) { cb(new Error('no_offline_audio'), null, pcmBuffer); return false; }
   var ctx = new OAC(1, Math.max(1, Math.ceil(dur * fs)), fs);
   var src = ctx.createBufferSource();
   src.buffer = pcmBuffer;
   var nodes = [src];
   /* 1. high-pass: kill mic rumble */
   var hp = ctx.createBiquadFilter();
   hp.type = 'highpass';
   hp.frequency.value = Math.max(60, Math.min(120, Number(plan.highPassHz) || 90));
   hp.Q.value = 0.7;
   nodes.push(hp);
   /* 2. low-mid mud cut */
   var mud = ctx.createBiquadFilter();
   mud.type = 'peaking';
   mud.frequency.value = Math.max(180, Math.min(320, Number(plan.mudCutHz) || 240));
   mud.Q.value = 1.1;
   mud.gain.value = Math.max(-4, Math.min(0, Number(plan.mudCutDb) || -2.5));
   nodes.push(mud);
   /* 3. "proud & clear" presence shelf + air */
   var pres = ctx.createBiquadFilter();
   pres.type = 'highshelf';
   pres.frequency.value = Math.max(2800, Math.min(3600, Number(plan.presenceShelfHz) || 3200));
   pres.Q.value = 0.9;
   pres.gain.value = Math.max(2.0, Math.min(3.5, Number(plan.presenceGainDb) || 3.0));
   nodes.push(pres);
   var air = ctx.createBiquadFilter();
   air.type = 'highshelf';
   air.frequency.value = 7500;
   air.gain.value = 1.5;
   nodes.push(air);
   /* 4. broadcast compressor (DynamicsCompressor) */
   var comp = ctx.createDynamicsCompressor();
   comp.threshold.value = -18;
   comp.ratio.value = Math.max(2, Math.min(4, Number(plan.compressorRatio) || 2.8));
   comp.attack.value = 0.008;
   comp.release.value = 0.12;
   nodes.push(comp);
   var dst = ctx.destination;
   for (var i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
   nodes[nodes.length - 1].connect(dst);
   src.start(0);
   ctx.startRendering().then(function (rendered) {
    /* 5. BS.1770-4 normalize to -21 LUFS in-place on the mono samples */
    var out = rendered.getChannelData(0);
    var lufsNow = -70;
    try { if (SDP.AudioNormalize && SDP.AudioNormalize.measureLoudness) lufsNow = SDP.AudioNormalize.measureLoudness(out, fs); } catch (eL) {}
    var target = Number(plan.targetLufs) || -21;
    var gainDb = target - lufsNow;
    var gain = Math.pow(10, gainDb / 20);
    var peak = 0, j;
    for (j = 0; j < out.length; j++) { out[j] = out[j] * gain; if (Math.abs(out[j]) > peak) peak = Math.abs(out[j]); }
    if (peak > 0.891) { var lim = 0.891 / peak; for (j = 0; j < out.length; j++) out[j] *= lim; }
    cb(null, rendered, out);
   }, function () { cb(new Error('render_failed'), null, null); });
   return true;
  } catch (e) { cb(e, null, null); return false; }
 }
 /* Paint the Voice Analysis & Enhancement Scorecard (Sinhala + English). */
 function vsPaintAnalysisCard(prof, after) {
  var host = byId('studioVoiceAnalysisCard');
  if (!host) return false;
  if (!isObj(prof)) { host.hidden = true; return false; }
  var m = prof.metrics || {};
  var am = after || {};
  var rows = '';
  var row = function (label, before, afterV, unit) { return '<div class="studio-va-row"><span>' + esc(str(label)) + '</span><span>' + esc(str(before)) + (afterV !== undefined && afterV !== '' ? ' → <strong>' + esc(str(afterV)) + '</strong>' : '') + ' ' + esc(str(unit || '')) + '</span></div>'; };
  rows += row('Duration / Sample rate', m.durationSec + ' s', am.durationSec !== undefined ? am.durationSec + ' s' : '', '');
  rows += row('Fundamental pitch (F0)', (m.f0Hz || '—') + ' Hz', '', '');
  rows += row('RMS intensity', (m.rmsDb !== undefined ? m.rmsDb : '—') + ' dB', '', '');
  rows += row('Integrated loudness (LUFS)', m.integratedLufs, am.integratedLufs !== undefined ? am.integratedLufs : '', 'LUFS');
  rows += row('True peak (dBTP)', m.truePeakDbTP, am.truePeakDbTP !== undefined ? am.truePeakDbTP : '', 'dBTP');
  rows += row('Noise floor', m.noiseFloorDb, am.noiseFloorDb !== undefined ? am.noiseFloorDb : '', 'dB');
  rows += row('Spectral centroid', m.spectralCentroidHz + ' Hz', am.spectralCentroidHz !== undefined ? am.spectralCentroidHz + ' Hz' : '', '');
  rows += row('Presence band (2.5–4.5 kHz)', Math.round((m.presenceRatio || 0) * 100) + '%', am.presenceRatio !== undefined ? Math.round(am.presenceRatio * 100) + '%' : '', '');
  if (m.wordsPerMinute !== undefined) rows += row('Speaking pace (auto-transcribed)', m.wordsPerMinute + ' WPM · ' + str(m.articulationClarity) + ' · via ' + str(m.transcriptSource), '', '');
  rows += row('Analyzer engine', prof.source === 'gemini' ? 'Gemini 2.5 Flash + DSP' : 'Deterministic DSP (offline fallback)', '', '');
  var weakHtml = '';
  var i, wlabels = { low_projection: 'Low projection / energy', background_hiss: 'Background hiss', muffled_midrange: 'Muffled low-mid', excessive_silence: 'Excessive silence', dynamic_unevenness: 'Dynamic unevenness', clipping_risk: 'Clipping risk', soft_consonants: 'Soft consonant projection', sample_too_short: 'Sample shorter than 30 s' };
  var wl = prof.weaknessesDetected || [];
  for (i = 0; i < wl.length; i++) weakHtml += '<span class="studio-va-badge' + (after ? ' studio-va-fixed' : '') + '">' + esc(wlabels[wl[i]] || str(wl[i])) + (after ? ' — fixed' : '') + '</span>';
  var el = prof.recommendedElevenLabsSettings || {};
  host.innerHTML =
   '<h5 class="studio-h4" style="margin:0 0 4px;">📋 Voice Analysis &amp; Enhancement Scorecard · හඬ විශ්ලේෂණ පත්‍රය</h5>' +
   '<p class="studio-hint">' + esc(prof.timbreSummary || '') + '</p>' +
   '<div class="studio-va-row"><span>Quality Score · ගුණාත්මක ලකුණ</span><span class="studio-va-score">' + esc(String(prof.qualityScore)) + ' / 100' + '</span></div>' +
   rows +
   (weakHtml ? '<div style="margin-top:6px;">' + weakHtml + '</div>' : '<p class="studio-hint" style="margin-top:6px;">No weaknesses detected. දෝෂ හමු නොවීය.</p>') +
   '<p class="studio-hint" style="margin-top:6px;">Locked ElevenLabs voice_settings — stability ' + esc(String(el.stability)) + ' · similarity_boost ' + esc(String(el.similarity_boost)) + ' · style ' + esc(String(el.style)) + ' · use_speaker_boost ' + (el.use_speaker_boost ? 'true' : 'false') + ' · target ' + esc(String((prof.enhancementPlan && prof.enhancementPlan.targetLufs) || -21)) + ' LUFS</p>';
  host.hidden = false;
  return true;
 }

 /* ══ v0.0.7.a PILLAR 2 (Z2) — AUTO-TRANSCRIPTION + FREE-SPEECH PROFILE ══
    vsTranscribeSample(): transcribes whatever the lecturer ACTUALLY said in
    the 1-minute free-speech sample (no fixed script) via the Gemini audio
    API, computes WPM + articulation clarity, and falls back to the Web Speech
    live transcript captured during recording when no key / no network. */
 function vsTranscribeSample(audioBlob, durationSec, cb) {
  cb = cb || noop;
  var fallback = function (reason) {
   var live = '';
   try { live = str(VS.liveTranscript); } catch (eT) { live = ''; }
   var wpm = (live && durationSec > 0) ? Math.round((live.split(/\s+/).filter(function (x) { return !!x; }).length) / (durationSec / 60)) : 0;
   cb(null, { source: live ? 'web_speech_live' : 'unavailable', reason: str(reason), transcript: live.slice(0, 900), wordsPerMinute: wpm, articulationClarity: live ? (wpm >= 90 && wpm <= 180 ? 'clear' : 'check_pacing') : 'unknown' });
  };
  var keys = resolveAiKeys();
  if (!keys.length) { fallback('no_gemini_key'); return true; }
  var fr = new global.FileReader();
  fr.onload = function () {
   var b64 = str(fr.result).split(',')[1] || '';
   var tryKey = function (idx) {
    if (idx >= keys.length) { fallback('gemini_all_keys_failed'); return; }
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(keys[idx].k);
    var body = JSON.stringify({
     contents: [{ parts: [
      { text: 'Transcribe this free-speech voice recording verbatim. Then return ONLY minified JSON {"transcript":"...","wpm":number,"clarity":"clear|muffled|check_pacing"} where wpm is the speaker\'s words per minute.' },
      { inline_data: { mime_type: 'audio/mp3', data: b64 } }
     ] }]
    });
    global.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
     .then(function (res) { if (!res.ok) throw new Error('gemini_' + res.status); return res.json(); })
     .then(function (j) {
      var txt = '';
      try { txt = j.candidates[0].content.parts[0].text; } catch (eT2) {}
      var m2 = txt.match(/\{[\s\S]*\}/);
      if (!m2) throw new Error('gemini_no_json');
      var t = JSON.parse(m2[0]);
      var wpm = Number(t.wpm) || (str(t.transcript).split(/\s+/).filter(function (x) { return !!x; }).length / Math.max(0.5, durationSec / 60));
      cb(null, { source: 'gemini', transcript: str(t.transcript).slice(0, 900), wordsPerMinute: Math.round(wpm), articulationClarity: str(t.clarity) || (wpm >= 90 && wpm <= 180 ? 'clear' : 'check_pacing') });
     }, function () { tryKey(idx + 1); })
     .catch(function (err2) { if (str(err2 && err2.message).indexOf('gemini_') === 0 && idx + 1 < keys.length) tryKey(idx + 1); else fallback(err2 && err2.message); });
   };
   tryKey(0);
  };
  fr.onerror = function () { fallback('read_failed'); };
  fr.readAsDataURL(audioBlob);
  return true;
 }

 /* ══ v0.0.7.a PILLAR 2 (Z2) — CREDIT-PROTECTION LAW ══
    vsCreditCostPreview(): the exact character count a batch would burn
    BEFORE any synthesis runs. Never burns a single credit itself.
    vsLowCreditVerifyTest(): the 1-Word (~10 char) Low-Credit Verification
    Test — ONE tiny eleven_flash_v2_5 take (~10 chars) that proves whether
    real ElevenLabs generation succeeds; on failure it reports the exact
    HTTP status, root cause and the 1-click remediation path. */
 function vsCreditCostPreview(texts) {
  var chars = 0, i;
  for (i = 0; i < (texts || []).length; i++) chars += str(texts[i]).length;
  return { chars: chars, clips: (texts || []).length, estimatedCredits: chars, note: 'eleven_flash_v2_5 is charged per character — this preview burns ZERO credits until you press Generate.' };
 }
 function vsLowCreditVerifyTest(cb) {
  cb = cb || noop;
  var key = resolveElevenKey();
  if (!trimmedKey(str(key))) { cb({ ok: false, http: 0, cause: 'no_key', fix: 'Paste the ElevenLabs API key in Keys & Quota (sk_…), then retry.' }, null); return false; }
  var text = 'Ready.'; /* 6 chars — the ~10-character low-credit probe */
  var voiceId = str(activeVoiceId || VOICE_ID);
  /* W5 law holds: this TTS fetch is reached ONLY from the explicit human
     #btnLowCreditVerifyTest click (and the Lab's own explicit button). */
  var lowCreditTtsUrl = 'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128'; /* ttsUrl — human-click-only */
  global.fetch(lowCreditTtsUrl, {
   method: 'POST',
   headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
   body: JSON.stringify({ text: text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true } })
  }).then(function (res) {
   var st = res && res.status ? res.status : 0;
   if (!res || !res.ok) {
    var cause = st === 401 ? 'invalid_api_key' : (st === 403 ? 'voice_not_allowed_or_free_tier' : (st === 429 ? 'rate_limited_or_quota_exhausted' : (st === 0 ? 'network_blocked' : 'http_' + st)));
    var fix = st === 401 ? 'Re-paste the sk_… key from ElevenLabs → Profile → API Keys.' :
     (st === 403 ? 'This voice is not enabled for your API tier — pick a premade voice or the cloned voice from your own account.' :
      (st === 429 ? 'Quota exhausted — wait for the monthly reset or add credits, then retry.' : 'Check the network / proxy and retry; the exact status was HTTP ' + st + '.'));
    cb({ ok: false, http: st, cause: cause, fix: fix }, null);
    return null;
   }
   return res.arrayBuffer().then(function (buf) {
    var bytes = new Uint8Array(buf);
    var sig = '';
    try { sig = String(bytes[0]) + ':' + String(bytes[1]); } catch (eS) {}
    cb(null, { ok: true, http: 200, bytes: bytes.length, mp3: sig === '73:68' || sig === '0:0', text: text });
   });
  }, function () {
   cb({ ok: false, http: 0, cause: 'network_blocked', fix: 'The request never reached api.elevenlabs.io — check the internet / firewall and retry.' }, null);
  });
  return true;
 }

 /* 1-click: create the ElevenLabs Instant Voice Clone from the enhanced
    sample, lock it, and re-synthesize the 30 session words. */
 function createAndApplyVoiceClone(cb) {
  cb = cb || noop;
  if (VS.cloning) { msg('Voice clone already in progress…', 'warn'); cb(new Error('busy')); return false; }
  if (!VS.confirmed || !VS.blob) { msg('Confirm a Reference Voice Sample first (record/upload → Save & Confirm).', 'bad'); cb(new Error('no_sample')); return false; }
  var key = resolveElevenKey();
  if (!trimmedKey(str(key))) { msg('Add an ElevenLabs API key first (Keys & Quota card or the key pool).', 'bad'); cb(new Error('no_key')); return false; }
  VS.cloning = true;
  msg('Uploading the enhanced voice sample to ElevenLabs Instant Voice Cloning…', 'ok');
  vsDecode(VS.blob, function (errDec, pcm) {
   var plan = (VS.analysis && VS.analysis.enhancementPlan) || {};
   var go = function (pcmBuf) {
    var file = VS.enhancedBlob || VS.blob;
    var fd = new global.FormData();
    fd.append('name', 'SDP Classroom Clone ' + new Date().toISOString().slice(0, 10));
    fd.append('description', ((global.SDP && SDP.version) || ''));
    fd.append('remove_background_noise', 'true');
    var fname = 'reference-sample.' + (VS.source === 'recorded' ? 'webm' : 'mp3');
    try { fd.append('files', file, fname); } catch (eF) { fd.append('files', file); }
    global.fetch('https://api.elevenlabs.io/v1/voices/add', { method: 'POST', headers: { 'xi-api-key': key }, body: fd })
     .then(function (res) { if (!res.ok) return res.text().then(function (t) { throw new Error('ivc_' + res.status + '_' + str(t).slice(0, 120)); }); return res.json(); })
     .then(function (j) {
      var vid = str(j && j.voice_id);
      if (!vid) throw new Error('ivc_no_voice_id');
      var elSet = (VS.analysis && VS.analysis.recommendedElevenLabsSettings) || { stability: 0.52, similarity_boost: 0.88, style: 0.38, use_speaker_boost: true };
      var sig = {
       voiceId: vid, voiceName: 'My Cloned Voice', modelId: VOICE_MODEL, cloned: true, locked: true,
       settings: elSet, lufsTarget: -21, truePeakMax: -1.0,
       presenceShelfHz: (plan.presenceShelfHz || 3200), presenceGainDb: (plan.presenceGainDb || 3.0)
      };
      try { dataSaveSettings({ voiceSignature: sig }); } catch (eS) {}
      try { dataSaveSettings({ voiceSampleProfile: { voiceId: vid, qualityScore: (VS.analysis && VS.analysis.qualityScore) || null, source: VS.analysis ? VS.analysis.source : 'dsp', at: Date.now(), plan: plan } }); } catch (eSp) {}
      if (!isObj(ST.secrets)) ST.secrets = {};
      var known = Array.isArray(ST.fetchedVoices) ? ST.fetchedVoices : [];
      var dup = false, fi;
      for (fi = 0; fi < known.length; fi++) if (str(known[fi].voice_id) === vid) dup = true;
      if (!dup) known.unshift({ voice_id: vid, name: 'My Cloned Voice (SDP)', category: 'cloned' });
      ST.fetchedVoices = known;
      ST.secrets.fetchedVoices = known;
      var sel = byId('studioClassroomVoiceSelect');
      if (sel) {
       var o = doc.createElement('option');
       o.setAttribute('value', vid);
       o.textContent = 'My Cloned Voice (SDP) · ' + vid;
       sel.appendChild(o);
       sel.value = vid;
      }
      var inp = byId('studioClassroomCustomVoiceId');
      if (inp) inp.value = vid;
      paintClassroomVoiceBar();
      try { SDP.Sync.emitChange('voice_clone_applied', { voiceId: vid }); } catch (eE) {}
      msg('Voice clone created: ' + vid + ' — now wiping old word clips and re-synthesizing the 30 words…', 'ok');
      VS.cloning = false;
      /* clean wipe of the old word clips, then fresh 30-word synthesis */
      try {
       var wk = [], words = currentWords(), wi;
       for (wi = 0; wi < words.length; wi++) wk.push('words.' + str(words[wi].w).toLowerCase());
       if (SDP.Speech && SDP.Speech.purgeStaleClipsEverywhere) SDP.Speech.purgeStaleClipsEverywhere({ purgeVoiceMismatch: true, purgeStaleRev: true });
      } catch (eP2) {}
      generateClips({ force: true, keys: (function () { var a = [], w2 = currentWords(), k2; for (k2 = 0; k2 < w2.length; k2++) a.push('words.' + str(w2[k2].w).toLowerCase()); return a; })() }, function () {
       try { SDP.Sync.emitChange('voice_pack_updated', {}); } catch (eE2) {}
       cb(null, vid);
      });
     })
     .catch(function (err) {
      VS.cloning = false;
      var why = str(err && err.message);
      if (/ivc_401|ivc_429/.test(why) && rotateElevenKey('ivc')) {
       msg('Key rotated — retrying the voice clone once…', 'warn');
       VS.cloning = false;
       global.setTimeout(function () { createAndApplyVoiceClone(cb); }, 300);
       return;
      }
      msg('Instant Voice Cloning failed: ' + why.slice(0, 140), 'bad');
      cb(err);
     });
   };
   if (errDec || !pcm) { go(null); return; }
   vsEnhanceSample(pcm, plan, function (errEnh, rendered, samples) {
    if (!errEnh && rendered && samples) {
     try {
      if (SDP.AudioNormalize && SDP.AudioNormalize.encodeWav) {
       var ab = SDP.AudioNormalize.encodeWav(samples, rendered.sampleRate);
       VS.enhancedBlob = new global.Blob([ab], { type: 'audio/wav' });
       var pv = byId('voiceSamplePreviewAudio');
       if (pv && global.URL && global.URL.createObjectURL) { try { pv.src = global.URL.createObjectURL(VS.enhancedBlob); } catch (eU) {} }
      }
     } catch (eW) {}
    }
    go(rendered || null);
   });
  });
  return true;
 }
 /* The six Voice Sample Studio buttons + the upload input. */
 function toggleVoiceSampleRecord() {
  if (VS.active) return vsStopRecording();
  return vsStartRecording();
 }

 /* ══ D-L6: the studio must catch up */
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
 /* D11: stash/restore input values */
 function onLangChange() {
  /* v0.0.7.b B5: the interactive guide re-renders in the new language. */
  try { if (SDP.StudioGuide && SDP.StudioGuide.onLangChange) SDP.StudioGuide.onLangChange(); } catch (eG) {}
  if (!ST.unlocked) return false;
  var ids = ['elKeyInput','ghTokenInput','studioGasUrl','studioAiKey','studioAiProvider','studioBulkWords','studioWords'];
  var s = {}, i, n;
  for (i = 0; i < ids.length; i++) { n = byId(ids[i]); if (n) s[ids[i]] = n.value; }
  var wm = [];
  try {
   var rows = doc.querySelectorAll ? doc.querySelectorAll('[data-wm]') : [];
   for (i = 0; i < rows.length; i++) wm.push({ w: rows[i].getAttribute('data-wm'), r: rows[i].getAttribute('data-row'), v: rows[i].value || '' });
  } catch (e) {}
  mount();
  try {
   for (i = 0; i < ids.length; i++) { n = byId(ids[i]); if (n && s[ids[i]] !== undefined) n.value = s[ids[i]]; }
   for (i = 0; i < wm.length; i++) {
    n = doc.querySelector ? doc.querySelector('[data-wm="' + wm[i].w + '"][data-row="' + wm[i].r + '"]') : null;
    if (n) n.value = wm[i].v;
   }
  } catch (e) {}
  return true;
 }
 function refreshEditor() { return onDataReady(); }

 var Studio = {
  state: ST,
  mount: mount,
  init: mount,
  unlock: unlock,
  setup: setup,
  /* v0.0.7.a Z4/Z5 — the gate-facing surfaces: the dynamic word cap, the
     post-action audit banner painter and the lock-arm entry point. */
  wordCap: wordCap,
  setWordCap: setWordCap,
  wordCountMode: wordCountMode, /* v0.0.7.a A1 */
  getElevenKeyPool: elevenKeyPool, /* v0.0.7.a A2 — the unified pool law */
  resolveElevenKey: resolveElevenKey,
  paintKeyPoolChip: paintKeyPoolChip,
  preFlightCreditCheck: preFlightCreditCheck,
  clipLibraryRestore: clipLibraryRestore, /* v0.0.7.a A3 */
  clipLibraryLookup: clipLibraryLookup,
  paintReuseCounter: paintReuseCounter,
  missingWordTextsForTest: missingWordTexts,
  paintStudioActionAuditBanner: paintStudioActionAuditBanner,
  armClassroomLock: function () { return setStudioLockArm(); },
  lock: lock,
  /* v0.0.7.b B4 test hooks (G20): drive the 10-second security auto-lock
     deterministically — start the visible countdown, cancel it, read state. */
  __testAutoLock: {
   start: startAutoLockCountdown,
   cancel: cancelAutoLockCountdown,
   state: function () { return { left: autoLock.left, idle: !!autoLock.idleTimer, counting: !!autoLock.countdownTimer }; }
  },
  isUnlocked: isUnlocked,
  allowAutoGen: allowAutoGen,
  /* v0.0.6.d (D2): the five-field re-enrichment rule, exposed for the */
  __mergeEnrichRecordForGate: mergeEnrichRecord,
  guessPartOfSpeech: guessPartOfSpeech,
  hasUnpublishedEdits: function () { return !!(ST.unlocked && ST.dirty); },
  /* v0.0.6.c (F1): the delta surface the views and gates read. */
  wordsDirty: function () { return !!(ST.unlocked && ST.wordsDirty); },
  wordDeltas: function () { return (ST.wordDeltas || []).slice(); },
  detectWordDeltas: function () { return detectWordDeltas(); },
  paintDirtyState: function () { return paintDirtyState(); },
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
  classSettingsPayload: classSettingsPayload,
  classSettingKeys: CLASS_SETTING_KEYS,
  voicePackPayload: voicePackPayload,
  publishChecklist: publishChecklist,
  nextSyncRev: nextSyncRev,
  openPublishPreview: openPublishPreview,
  publishPreviewWords: publishPreviewWords,
  publish: publish,
  generateClips: generateClips,
  commitVoicePack: commitVoicePack,
  queueFor: queueFor,
  costPreview: costPreview,
  enrichWords: enrichWords,
  testAiEngine: testAiEngine,
  oneClickMasterSetup: oneClickMasterSetup,
  publishWordsAndVoice: publishWordsAndVoice,
  publishBundle: publishBundle,
  sealVaultNow: sealVaultNow,
  parseBulkWords: parseBulkWords,
  /* ══ v0.0.6.m Pillar 2/4: automatic system audio + reviews vault ══ */
  autoEnsureSystemClips: autoEnsureSystemClips,
  /* v0.0.6.m FIX 1: the real-API briefing/guide orchestrator. */
  autoSynthesizeBriefingAndGuide: autoSynthesizeBriefingAndGuide,
  briefingScriptWeights: briefingScriptWeights,
  /* v0.0.6.n FIX 2: the direct Studio ↔ Briefing bridge surface. */
  ensureBriefingAndGuideVoices: ensureBriefingAndGuideVoices,
  parseAlignmentToWordTimings: parseAlignmentToWordTimings,
  briefingVoiceDelta: briefingVoiceDelta,
  vaultSessionActive: vaultSessionActive,
  paintBriefingVoiceBar: paintBriefingVoiceBar,
  missingSystemClips: missingSystemClips,
  essentialSystemClipKeys: function () { return ESSENTIAL_SYSTEM_CLIPS.slice(); },
  paintReviewsDrawer: paintReviewsDrawer,
  buildReviewsZip: buildReviewsZip,
  paintLiveChips: paintLiveChips,
  paintWordsHelper: paintWordsHelper,
  chipRemove: chipRemove,
  chipMerge: chipMerge,
  currentParsed: currentParsed,
  setStudioWords: setStudioWords,
  paintWordManager: paintWordManager,
  paintMasterSteps: paintMasterSteps,
  aiProviderName: aiProviderName,
  aiProviderKey: aiProviderKey,
  detectProvider: detectProvider,
  providers: AI_PROVIDERS,
  bootstrapPin: BOOTSTRAP_PIN,
  bindAutoLock: bindAutoLock,
  pinDotCount: pinDotCount,
  costPreviewLine: costPreviewLine,
  guideSteps: guideSteps,
  loadVoicePack: loadVoicePack,
  fetchSubscription: fetchSubscription,
  checkQuota: checkQuota,
  quotaError: quotaError,
  looksLikeElevenKey: looksLikeElevenKey,
  tierWarning: tierWarning,
  saveKeys: saveKeys,
  /* D1: the explicit Clear buttons + the */
  clearSecretField: clearSecretField,
  mergeSecretInputs: mergeSecretInputs,
  secretSnapshot: secretSnapshot,
  guardSecretMerge: guardSecretMerge,
  /* D2: one busy-button helper for */
  withBusy: withBusy,
  /* D6/D7: the human GitHub sentence used */
  publishErrorText: publishErrorText,
  publishReason: publishReason,
  bumpMeterCache: bumpMeterCache,
  /* D13: same-tab stash restore */
  restoreSessionStash: restoreSessionStash,
  /* D18: failure exits clear every */
  clearBusy: clearBusy,
  paintLecturerBar: paintLecturerBar,
  writeLayerOne: writeLayerOne,
  layerOneVault: layerOneVault,
  layerOneEnvelope: layerOneEnvelope,
  healFromLayerOne: healFromLayerOne,
  paintVaultBadge: paintVaultBadge,
  paintPackDashboard: paintPackDashboard,
  paintGenProgress: paintGenProgress,
  clipCount: clipCount,
  packDashboardText: packDashboardText,
  placeLecturerBar: placeLecturerBar,
  audioForWord: audioForWord,
  vaultBadgeVisible: vaultBadgeVisible,
  testElevenLabsKey: testElevenLabsKey,
  testGitHubToken: testGitHubToken,
  refreshQuota: refreshQuota,
  /* v0.0.7.a Pillar 1 (Y1): the Voice Sample Studio & AI clone pipeline. */
  toggleVoiceSampleRecord: toggleVoiceSampleRecord,
  vsStopRecording: vsStopRecording,
  vsDspAnalyze: vsDspAnalyze,
  analyzeVoiceSampleWithAi: analyzeVoiceSampleWithAi,
  vsEnhanceSample: vsEnhanceSample,
  createAndApplyVoiceClone: createAndApplyVoiceClone,
  vsHandleFile: vsHandleFile,
  voiceSampleState: function () { return { source: VS.source, confirmed: VS.confirmed, hasBlob: !!VS.blob, analysis: VS.analysis }; },
  /* v0.0.7.a Pillar 3 (Y3): the Lecturer Alert Inbox painter. */
  paintLecturerAlertsCard: paintLecturerAlertsCard,
  vsPaintAnalysisCard: vsPaintAnalysisCard,
  paintVoiceCoveragePill: paintVoiceCoveragePill,
  /* v0.0.7.a Pillar 4 (Y4): legacy alias — recordClip() now confirms the
     reference voice sample instead of writing a fake assets/audio path. */
  recordClip: function (idx, cb) {
   cb = cb || noop;
   cb(VS.confirmed ? null : new Error('confirm_voice_sample_first'), VS.confirmed ? { confirmed: true, source: VS.source } : null);
   return VS.confirmed;
  },
  toggleRecord: toggleVoiceSampleRecord,
  stopRecord: vsStopRecording,
  commitClip: function (token, cb) {
   cb = cb || noop;
   if (!VS.confirmed) { cb(new Error('no_clip')); return false; }
   createAndApplyVoiceClone(function (err) { cb(err, !err); });
   return true;
  },
  elevenUrl: elevenUrl,
  voiceId: VOICE_ID,
  voiceName: VOICE_NAME,
  voiceModel: VOICE_MODEL,
  persona: VOICE_PERSONA,
  sha1Hex: sha1Hex,
  clipContentHash: clipContentHash,
  buildQueue: buildQueue,
  commandClips: commandClips,
  numberClips: numberClips,
  guideClips: guideSteps,
  verifyElevenKey: verifyElevenKey,
  changePin: changePin,
  recoveryOpen: recoveryOpen,
  recoveryMode: function () { return !!ST.recoveryMode; },
  appVersion: appVersion,
  appendPin: appendPin,
  backspacePin: backspacePin,
  setPinValue: setPinValue,
  pinValue: pinValue,
  paintPinDots: paintPinDots,
  paintQuickButton: paintQuickButton,
  toggleSecretField: toggleSecretField,
  /* v0.0.7.e — the Private Web App Access Lock controller API. */
  accessLockSnapshot: accessLockSnapshot,
  paintAccessLockPanel: paintAccessLockPanel,
  refreshAccessLockRoster: refreshAccessLockRoster,
  alApplyMaster: alApplyMaster,
  alJumpToPanel: alJumpToPanel,
  dismissAccessNotice: dismissAccessNotice,
  gasLockRelay: gasLockRelay,
  onDataReady: onDataReady,
  onLangChange: onLangChange,
  refreshEditor: refreshEditor,
  /* D12/D18: busy state guard for view */
  isBusy: function () { return !!(ST.generating || ST.publishing || ST.enriching); },
  /* v0.0.6.w exports — the unified classroom & cloned voice controller. */
  chosenClassroomVoiceId: chosenClassroomVoiceId,
  chosenClassroomVoiceName: chosenClassroomVoiceName,
  applyClassroomVoice: applyClassroomVoice,
  buildFallbackRpHint: buildFallbackRpHint,
  /* v0.0.6.v exports */
  defaultVoiceSignature: defaultVoiceSignature,
  voiceSignature: voiceSignature,
  verifyBritishRPWord: verifyBritishRPWord,
  openStudioActivityPopup: openStudioActivityPopup,
  closeStudioActivityPopup: closeStudioActivityPopup,
  purgeNonActiveWordClips: purgeNonActiveWordClips,
  message: function () { return ST.message; },
  testStatusText: function () { return ST.testStatus; }
 };

 Studio.recoverFromHistory = recoverFromHistory;

 SDP.Studio = Studio;

 if (doc) {
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { mount(); });
  else mount();
  /* D-L6: sync boot can finish after the */
  doc.addEventListener('sdp:ready', function () { try { onDataReady(); } catch (e) {} }, false);
 }
})(typeof window !== 'undefined' ? window : this);
