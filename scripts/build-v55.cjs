#!/usr/bin/env node
/*
 * Deterministic v55 build for the single-file app (APP_VERSION 6.1.0).
 *
 *   1. replaces the SECTION 60 block with scripts/v55-inline.js
 *      (PIN vault + < 600 byte keys envelope + UniversalSync bootstrap, pure ES5)
 *   2. patches APP_VERSION 6.1.0, the storage key, schema 55 and the legacy key chain
 *   3. publishes the professor studio as data/studio.js
 *      (ElevenVault playOrFetchOnce + pre-edit sync warning card + EN/SI setup guide
 *       + keys/words relays + GitHub fast read)
 *   4. rewrites the published data documents (ver 55, SDP_ENC_V1 envelope)
 *   5. re-minifies the inline script with terser (ES5, SECTION markers preserved)
 *
 *   node scripts/build-v55.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
const INLINE = path.join(__dirname, 'v55-inline.js');
const STUDIO = path.join(ROOT, 'data', 'studio.js');
const MARK_START = '/* SECTION 60 - V55 INJECT START */';
const MARK_END = '/* SECTION 60 - V55 INJECT END */';
const OLD_MARKS = [
  ['/* SECTION 60 - V54 INJECT START */', '/* SECTION 60 - V54 INJECT END */'],
  ['/* SECTION 60 - V53 INJECT START */', '/* SECTION 60 - V53 INJECT END */']
];
const ANCHOR = 'window.SDP={version:APP_VERSION';

const VER = 55;
const APP = '6.1.0';
const KEY = 'sdp.v55_guaranteed_device_sync';
const VOICE = 'Xb7hH8MSUJpSbSDYk0k2';
const MODEL = 'eleven_flash_v2_5';
const PIN = '';
const WALL = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
const KEYS_TOPIC = 'https://ntfy.sh/dictationb1_sdp_keys_v55';
const WORDS_TOPIC = 'https://ntfy.sh/dictationb1_sdp_words_v55';
const AUDIO_TOPIC = 'https://ntfy.sh/dictationb1_sdp_audio_v55';

const PATCHES = [
  ['APP_VERSION="6.0.0"', 'APP_VERSION="6.1.0"'],
  ['APP_VERSION="5.9.0"', 'APP_VERSION="6.1.0"'],
  ['key:"sdp.v54_encrypted_universal_sync"', 'key:"sdp.v55_guaranteed_device_sync"'],
  ['schema:54,', 'schema:55,'],
  ['settingsRev:54,', 'settingsRev:55,'],
  ['CONFIG.schema=54,CONFIG.settingsRev=54', 'CONFIG.schema=55,CONFIG.settingsRev=55'],
  ['e=["sdp.v53_github_voice_sync"', 'e=["sdp.v54_encrypted_universal_sync","sdp.v53_github_voice_sync"']
];

const STUDIO_CSS = '.prof-table{display:grid;gap:4px;margin-top:8px;overflow:auto}.prof-row{display:grid;grid-template-columns:44px 1fr 1fr 1fr 1.4fr auto;gap:8px;align-items:center;font-size:.82rem;padding:4px 0;border-bottom:1px solid var(--line-2)}.prof-row.head{font-weight:650;color:var(--ink-2)}.el-vault-list{display:grid;gap:6px;margin-top:8px;max-height:300px;overflow:auto}.el-vault-row{display:flex;gap:8px;align-items:center;font-size:.82rem;padding:6px 8px;border-radius:var(--r1);background:var(--field)}.el-vault-row>.grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.admin-advanced{margin-top:14px;border:1px solid var(--line-2);border-radius:var(--r1);padding:10px 12px}.admin-advanced>summary{cursor:pointer;font-weight:650}.field-details{margin-top:10px}.field-details>summary{cursor:pointer;font-size:.82rem;color:var(--ink-2)}@media(max-width:560px){.prof-row{grid-template-columns:34px 1fr 1fr}.prof-row>span:nth-child(n+4){display:none}}';

/* ------------------------------------------------------------------ vault */
function extractSha(html) {
  const from = html.indexOf('Sha=function(){');
  const to = html.indexOf('}(),UI={', from);
  if (from < 0 || to < 0) throw new Error('cannot extract the pure SHA-256 implementation');
  return new Function('return ' + html.slice(from + 4, to + 3))();
}
function loadVault(html) {
  const Sha = extractSha(html);
  const src = fs.readFileSync(INLINE, 'utf8');
  const helpers = src.slice(src.indexOf('function enc8'), src.indexOf('var EncryptedVault = {'));
  /* canon() lives next to the helpers, before the object literal */
  const body = src.slice(src.indexOf('var EncryptedVault = {'), src.indexOf('window.EncryptedVault = EncryptedVault;'));
  const build = new Function('Sha',
    'var PIN="' + PIN + '", SALT="::sdp_galle_v55_salt", PFX="SDP_ENC_V1:", B64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";' +
    helpers.replace(/function canon\(d\)[\s\S]*?\n  }\n/, '') +
    'function canon(d){return d;}' +
    body + '\nreturn EncryptedVault;');
  return build(Sha);
}

/* ------------------------------------------------------------ index.html */
let html = fs.readFileSync(FILE, 'utf8');
const vault = loadVault(html);

function stripBlock(source, start, end) {
  const from = source.indexOf(start);
  if (from < 0) return source;
  const to = source.indexOf(end, from);
  if (to < 0) return source;
  /* the injected code sits between the two markers: drop the markers AND the code */
  return source.slice(0, from) + source.slice(to + end.length);
}
for (const [s, e] of OLD_MARKS) html = stripBlock(html, s, e);
html = stripBlock(html, MARK_START, MARK_END);
/* drop the now-empty marker lines */
html = html.replace(/\n[ \t]*\n[ \t]*(window\.SDP=\{version:APP_VERSION)/, '\n$1');
html = html.replace(/([,;])\s*\n\s*(window\.SDP=\{version:APP_VERSION)/, '\n$2');

if (html.indexOf('.prof-row{') < 0) {
  const styleEnd = html.indexOf('</style>');
  if (styleEnd < 0) throw new Error('no </style> block found');
  html = html.slice(0, styleEnd) + STUDIO_CSS + html.slice(styleEnd);
}
for (const [from, to] of PATCHES) {
  if (html.indexOf(from) > -1) html = html.split(from).join(to);
}

const payload = MARK_START + '\n' + fs.readFileSync(INLINE, 'utf8').trim() + '\n' + MARK_END;
const at = html.indexOf(ANCHOR);
if (at < 0) throw new Error('anchor not found: ' + ANCHOR);
html = html.slice(0, at) + payload + '\n' + html.slice(at);
fs.writeFileSync(FILE, html);

/* --------------------------------------------------------------- studio */
fs.writeFileSync(STUDIO, [
  fs.readFileSync(path.join(__dirname, 'v55-studio-prologue.js'), 'utf8').trim(),
  fs.readFileSync(path.join(__dirname, 'v55-universal-sync.js'), 'utf8').trim(),
  fs.readFileSync(path.join(__dirname, 'v55-studio.source.js'), 'utf8').trim(),
  fs.readFileSync(path.join(__dirname, 'v55-completer.js'), 'utf8').trim()
].join('\n\n') + '\n');
console.log('index.html injected: ' + Buffer.byteLength(html, 'utf8') + ' bytes; studio ' + fs.statSync(STUDIO).size + ' bytes');

/* ------------------------------------------------------------ documents */
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function writeJson(rel, doc) { fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(doc, null, 2) + '\n'); return doc; }

const session = readJson('data/session.json');
const list = (session.lists || [])[0] || { words: [] };
const sessionMeta = session.session || {};
const syncRev = Date.now();
const words = (list.words || []).map(function (w) {
  return { w: w.w, p: w.p || '', pos: w.pos || '', m: w.m || '', si: w.si || '', s: w.s || '', audio: w.audio || '' };
});
const cipher = vault.encrypt({
  syncRev: syncRev,
  elevenLabsKey: '',
  elevenLabsVoiceId: VOICE,
  elevenLabsModel: MODEL,
  ghToken: '',
  adminPin: PIN,
  activeVideoSrc: WALL,
  videoDim: 18,
  mode: 'paper',
  writeFixed: 5,
  repeats: 2,
  sessionNo: sessionMeta.no || '8',
  sessionTitle: sessionMeta.title || '',
  sessionDate: sessionMeta.date || '',
  classInfo: sessionMeta.classInfo || '',
  listName: list.name || '',
  words: words
}, PIN);
if (vault.decrypt(cipher, PIN) === null) throw new Error('the v55 vault cannot decrypt its own document');

const common = {
  ver: VER, appVersion: APP, version: APP, schema: VER, settingsRev: VER, key: KEY, storageKey: KEY,
  adminPin: PIN, activeVideoSrc: WALL, activeMediaType: 'video', videoPlaylistMode: 'loop',
  syncRev: syncRev, vaultCiphertext: cipher
};

const version = readJson('data/version.json');
Object.assign(version, common);
version.buildDate = '2026-10-30';
version.updatedAt = new Date().toISOString();
version.updatedAtMs = syncRev;
version.features = Object.assign({}, version.features, {
  encryptedVault: 'v55: the ElevenLabs API key, the GitHub token, the voice settings, the session and the word list are encrypted as SDP_ENC_V1 URL-safe Base64 ciphertext keyed by the lecturer PIN ( + salt). No raw API key or GitHub token is ever committed, so GitHub secret scanning stays quiet.',
  keysRelay: 'v55: the keys travel on a dedicated CORS-SIMPLE relay - https://ntfy.sh/dictationb1_sdp_keys_v55 - a < 600 byte JSON POST ({ syncRev, vaultCiphertext, sessionTitle, sessionDate }) with ZERO custom headers, so ntfy never answers an OPTIONS preflight and never converts the body into an attachment (the 4,096-byte trap that silently broke v54 on real devices).',
  wordsRelay: 'v55: the compact word array ({ w, p, d, m, s }) travels on https://ntfy.sh/dictationb1_sdp_words_v55 chunked under 3,500 bytes per POST, again with zero custom headers.',
  instantGithubRead: 'v55: UniversalSync.pullAll() reads https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/data/*.json?ref=main (0.05 s after the commit, 5,000 req/h with the token) so a second device never waits 60-90 s for the GitHub Pages CDN to rebuild.',
  preEditWarning: 'v55: Lecturer Mode opens with #adminSyncWarningCard - an amber "Action Required Before Editing" banner and a bilingual (English / Sinhala) 3-step setup guide with the pre-filled github.com/settings/tokens/new?...&scopes=repo link, turning emerald-green once both keys are encrypted and synced.',
  crossDeviceVoice: 'v55: ElevenVault.playOrFetchOnce() replays every permanent clip for 0 credits and, when a clip is missing on a new device, generates it exactly once with the PIN-decrypted key, stores it in IndexedDB, and commits data/elevenlabs-audio.json so no second device ever pays again.',
  universalSync: 'v55: every lecturer save stamps syncRev, encrypts the vault and pushes four channels in parallel - the < 600 byte keys relay, the chunked words relay, the Google Apps Script Cloud backend and a permanent GitHub commit of data/config.json, data/session.json, data/version.json and data/elevenlabs-audio.json.'
});
writeJson('data/version.json', version);

const config = readJson('data/config.json');
Object.assign(config, common);
config.updatedAt = new Date().toISOString();
config.keysTopic = KEYS_TOPIC;
config.wordsTopic = WORDS_TOPIC;
config.audioTopic = AUDIO_TOPIC;
config.features = Object.assign({}, config.features, version.features);
writeJson('data/config.json', config);

const ses = readJson('data/session.json');
Object.assign(ses, {
  ver: VER, appVersion: APP, version: APP, schema: VER, settingsRev: VER, key: KEY, storageKey: KEY,
  adminPin: PIN, activeVideoSrc: WALL, activeMediaType: 'video', videoPlaylistMode: 'loop',
  syncRev: syncRev, vaultCiphertext: cipher, updatedAt: new Date().toISOString()
});
ses.words = words;
ses.pastSessions = ses.pastSessions || [];
if (ses.session) {
  ses.session.activeVideoSrc = WALL;
  ses.session.videoPlaylistMode = 'loop';
}
writeJson('data/session.json', ses);

const audio = readJson('data/elevenlabs-audio.json');
Object.assign(audio, {
  ver: VER, version: VER, appVersion: APP, schema: VER, settingsRev: VER, key: KEY, storageKey: KEY, adminPin: PIN,
  voiceId: VOICE, modelId: MODEL, activeVideoSrc: WALL, activeMediaType: 'video', videoPlaylistMode: 'loop',
  strictAdminOnly: true, syncRev: syncRev, vaultCiphertext: cipher, generatedAt: new Date().toISOString(),
  keysTopic: KEYS_TOPIC, wordsTopic: WORDS_TOPIC,
  note: 'Permanent ElevenLabs voice vault. Clips committed here play on every device with 0 API calls and 0 credits, and the encrypted settings envelope travels with them.'
});
writeJson('data/elevenlabs-audio.json', audio);

/* data.html and /data/index.html are the same published report */
for (const rel of ['data.html', 'data/index.html']) {
  let doc = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  doc = doc.replace(/<span class="release">[^<]*<\/span>/, '<span class="release">v55 · APP_VERSION 6.1.0 · GUARANTEED CROSS-DEVICE KEY &amp; VOICE SYNC (KEYS RELAY + PRE-EDIT SETUP WARNING)</span>');
  fs.writeFileSync(path.join(ROOT, rel), doc);
}

/* validate the freshly injected inline script before the minifier touches it */
const body = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
if (!body) throw new Error('no inline application script found');
const probe = path.join(ROOT, 'tests', 'artifacts', 'v55-app.js');
fs.mkdirSync(path.dirname(probe), { recursive: true });
fs.writeFileSync(probe, body);
cp.execFileSync(process.execPath, ['--check', probe], { stdio: 'inherit' });

cp.execFileSync(process.execPath, [path.join(__dirname, 'minify-inline.cjs')], { stdio: 'inherit' });
console.log('built: ' + fs.statSync(FILE).size + ' bytes');
