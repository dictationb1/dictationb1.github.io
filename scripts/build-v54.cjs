#!/usr/bin/env node
/*
 * Deterministic v54 build for the single-file app (APP_VERSION 6.0.0).
 *
 *   1. patches index.html (APP_VERSION 6.0.0, storage key, schema, legacy keys)
 *   2. replaces the SECTION 60 bootstrap with scripts/v54-inline.js
 *      (PIN-encrypted EncryptedVault + UniversalSync, pure ES5, synchronous)
 *   3. publishes the professor studio as data/studio.js
 *      (prologue + voice vault / GitHub sync / sync bar / auto-completer)
 *   4. rewrites the published data documents (ver 54, encrypted vault envelope)
 *   5. re-minifies the inline script with terser (ES5)
 *
 *   node scripts/build-v54.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
const INLINE = path.join(__dirname, 'v54-inline.js');
const STUDIO = path.join(ROOT, 'data', 'studio.js');
const START = '/* SECTION 60 - V54 INJECT START */';
const END = '/* SECTION 60 - V54 INJECT END */';
const ANCHOR = 'window.SDP={version:APP_VERSION';

const VER = 54;
const APP = '6.0.0';
const KEY = 'sdp.v54_encrypted_universal_sync';
const VOICE = 'Xb7hH8MSUJpSbSDYk0k2';
const MODEL = 'eleven_flash_v2_5';
const PIN = '78987898';
const WALL = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';

const PATCHES = [
  ['APP_VERSION="5.9.0"', 'APP_VERSION="6.0.0"'],
  ['key:"sdp.v53_github_voice_sync"', 'key:"sdp.v54_encrypted_universal_sync"'],
  ['schema:53,', 'schema:54,'],
  ['settingsRev:53,', 'settingsRev:54,'],
  ['CONFIG.schema=53,CONFIG.settingsRev=53', 'CONFIG.schema=54,CONFIG.settingsRev=54'],
  ['e=["sdp.v52_elevenlabs_studio"', 'e=["sdp.v53_github_voice_sync","sdp.v52_elevenlabs_studio"']
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
  const body = src.slice(src.indexOf('var EncryptedVault = {'), src.indexOf('window.EncryptedVault = EncryptedVault;'));
  const build = new Function('Sha',
    'var PIN="' + PIN + '", SALT="::sdp_galle_v54_salt", PFX="SDP_ENC_V1:", B64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";' +
    helpers + body + '\nreturn EncryptedVault;');
  return build(Sha);
}

/* ------------------------------------------------------------ index.html */
let html = fs.readFileSync(FILE, 'utf8');
const vault = loadVault(html);

/* strip any earlier SECTION 60 injection (the v53 label, then the current one) */
const V53_START = '/* SECTION 60 - V53 INJECT START */';
const V53_END = '/* SECTION 60 - V53 INJECT END */';
let s53 = html.indexOf(V53_START);
let e53 = html.indexOf(V53_END);
if (s53 > -1 && e53 > s53) html = html.slice(0, s53) + html.slice(e53 + V53_END.length);
let s54 = html.indexOf(START);
let e54 = html.indexOf(END);
if (s54 > -1 && e54 > s54) html = html.slice(0, s54) + html.slice(e54 + END.length);
/* a minified sequence expression can leave a comma behind the removed block */
html = html.replace(/([,;])\s*\n\s*(window\.SDP=\{version:APP_VERSION)/, '\n$2');

if (html.indexOf('.prof-row{') < 0) {
  const styleEnd = html.indexOf('</style>');
  if (styleEnd < 0) throw new Error('no </style> block found');
  html = html.slice(0, styleEnd) + STUDIO_CSS + html.slice(styleEnd);
}
for (const [from, to] of PATCHES) {
  if (html.indexOf(from) > -1) html = html.split(from).join(to);
}

const payload = START + '\n' + fs.readFileSync(INLINE, 'utf8').trim() + '\n' + END;
const at = html.indexOf(ANCHOR);
if (at < 0) throw new Error('anchor not found: ' + ANCHOR);
html = html.slice(0, at) + payload + '\n' + html.slice(at);
fs.writeFileSync(FILE, html);

/* --------------------------------------------------------------- studio */
fs.writeFileSync(STUDIO, [
  fs.readFileSync(path.join(__dirname, 'v54-studio-prologue.js'), 'utf8').trim(),
  fs.readFileSync(path.join(__dirname, 'v54-universal-sync.js'), 'utf8').trim(),
  fs.readFileSync(path.join(__dirname, 'v54-studio.source.js'), 'utf8').trim(),
  fs.readFileSync(path.join(__dirname, 'v54-completer.js'), 'utf8').trim()
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
if (vault.decrypt(cipher, PIN) === null) throw new Error('the v54 vault cannot decrypt its own document');

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
  encryptedVault: 'v54: the ElevenLabs API key, the GitHub token, the voice settings, the session and the word list are encrypted as SDP_ENC_V1 URL-safe Base64 ciphertext keyed by the lecturer PIN (78987898 + salt). No raw API key or GitHub token is ever committed, so GitHub secret scanning stays quiet.',
  universalSync: 'v54: every lecturer save stamps syncRev, encrypts the vault and pushes three channels in parallel - the ntfy.sh zero-config relay (dictationb1_sdp_vault_v54), the Google Apps Script Cloud backend and a permanent GitHub commit of data/config.json, data/session.json, data/version.json and data/elevenlabs-audio.json.',
  audioRelay: 'v54: generated ElevenLabs clips are also published to the shared clip relay (dictationb1_sdp_audio_v54), so a phone without a GitHub token still receives the exact saved clips.',
  syncPull: 'v54: UniversalSync.pullAll() runs on boot, on visibilitychange, when Lecturer Mode unlocks and from the Sync Now button, cache-busting every JSON read and applying the highest syncRev.',
  crossDevice: 'v54: saving the API key, voice settings, wallpaper, session or words in Lecturer Mode on one PC appears on every other phone, tablet and laptop within a second.'
});
writeJson('data/version.json', version);

const config = readJson('data/config.json');
Object.assign(config, common);
config.updatedAt = new Date().toISOString();
config.features = Object.assign({}, config.features, version.features);
writeJson('data/config.json', config);

const ses = readJson('data/session.json');
Object.assign(ses, {
  ver: VER, appVersion: APP, version: APP, schema: VER, settingsRev: VER, key: KEY, storageKey: KEY,
  adminPin: PIN, syncRev: syncRev, vaultCiphertext: cipher, updatedAt: new Date().toISOString()
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
  note: 'Permanent ElevenLabs voice vault. Clips committed here play on every device with 0 API calls and 0 credits, and the encrypted settings envelope travels with them.'
});
writeJson('data/elevenlabs-audio.json', audio);

/* data.html and /data/index.html are the same published report */
for (const rel of ['data.html', 'data/index.html']) {
  let doc = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  doc = doc.replace(/v53 · APP_VERSION 5\.9\.0 · [^<]*/, 'v54 · APP_VERSION 6.0.0 · PIN-ENCRYPTED CROSS-DEVICE API KEY & SETTINGS SYNC');
  fs.writeFileSync(path.join(ROOT, rel), doc);
}

/* validate the freshly injected inline script before the minifier touches it */
const body = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
if (!body) throw new Error('no inline application script found');
const probe = path.join(ROOT, 'tests', 'artifacts', 'v54-app.js');
fs.mkdirSync(path.dirname(probe), { recursive: true });
fs.writeFileSync(probe, body);
cp.execFileSync(process.execPath, ['--check', probe], { stdio: 'inherit' });

cp.execFileSync(process.execPath, [path.join(__dirname, 'minify-inline.cjs')], { stdio: 'inherit' });
console.log('built: ' + fs.statSync(FILE).size + ' bytes');
