'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const acorn = require('acorn');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const version = readJson('version.json');
const config = readJson('config.json');
const session = readJson('session.json');
const KEY = 'sdp.v38_human_reactions_voice';
const GH_KEY = 'sdp.gh_assets_v38';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
const OXFORD = 'https://ssl.gstatic.com/dictionary/static/sounds/20200429/';
const has = (s, token) => String(s).indexOf(token) !== -1;
const compact = s => String(s).replace(/\s+/g, '');
const cssText = () => (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ['', ''])[1];
const CSS = compact(cssText());
const hasCss = token => has(CSS, compact(token));
const script = (html.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1];

function withApp(fn, seed) {
  const app = harness(seed);
  try { return fn(app); } finally { app.close(); }
}

test('v38 build gate: single-file ES5, no static external links, under 442,000 bytes', () => {
  assert.ok(script.length > 100000, 'the main inline app is present');
  assert.doesNotThrow(() => acorn.parse(script, { ecmaVersion: 5 }));
  for (const token of ['const ', 'let ', '=>', '`', 'async function', 'await ']) {
    assert.ok(!has(script, token), 'ES5 only; found ' + token);
  }
  assert.ok(!has(html, '<link'), 'no static external or local link tag');
  assert.ok(!/<script[^>]+src=/.test(html), 'no external script tag');
  assert.ok(Buffer.byteLength(html) < 442000, 'index.html is under the 442,000-byte release budget');
  const check = cp.spawnSync(process.execPath, ['tests/check.cjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.ok(has(html, 'APP_VERSION="4.5.0"'));
});

test('release identity and defaults: schema 38, appVersion 4.5.0, English, Amy, paper, video and reactions', () => {
  for (const [name, data] of [['version', version], ['config', config], ['session', session]]) {
    assert.equal(data.ver, 38, name + '.ver');
    assert.equal(data.appVersion, '4.5.0', name + '.appVersion');
    assert.equal(data.settingsRev, 38, name + '.settingsRev');
    assert.equal(data.lang, 'en', name + '.lang');
    assert.equal(data.guideLang, 'en', name + '.guideLang');
    assert.equal(data.voice, 'Amy', name + '.voice');
    assert.equal(data.humanReactions, true, name + '.humanReactions');
    assert.equal(data.mode, 'paper', name + '.mode');
    assert.equal(data.activeVideoSrc, DEFAULT, name + '.activeVideoSrc');
    assert.equal(data.activeMediaType, 'video', name + '.activeMediaType');
    assert.equal(data.videoDim, 18, name + '.videoDim');
  }
  assert.equal(version.version, '4.5.0');
  assert.equal(version.storageKey, KEY);
  assert.equal(version.ghMediaCache, GH_KEY);
  assert.equal(config.storageKey, KEY);
  assert.equal(config.defaults.humanReactions, true);
  assert.equal(config.defaults.elevenLabsKey, '');
  assert.equal(config.session.humanReactions, true);
  assert.equal(session.storageKey, KEY);
});

test('CONFIG and defaultData expose the v38 key, Amy lock, v38 assets cache and human-reaction defaults', () => withApp(({ q }) => {
  assert.equal(q.APP_VERSION, '4.5.0');
  assert.equal(q.CONFIG.key, KEY);
  assert.equal(q.CONFIG.schema, 38);
  assert.equal(q.CONFIG.settingsRev, 38);
  assert.equal(q.CONFIG.lockedVoice, 'Amy');
  assert.equal(q.CONFIG.ghMediaCache, GH_KEY);
  assert.ok(q.CONFIG.legacyMediaCaches.indexOf('sdp.gh_assets_v37') >= 0);
  const d = q.DB.defaults();
  assert.equal(d.v, 38);
  assert.equal(d.settingsRev, 38);
  assert.equal(d.settings.lang, 'en');
  assert.equal(d.settings.guideLang, 'en');
  assert.equal(d.settings.mode, 'paper');
  assert.equal(d.settings.voice, 'Amy');
  assert.equal(d.settings.humanReactions, true);
  assert.equal(d.settings.elevenLabsKey, '');
  assert.equal(d.settings.activeVideoSrc, DEFAULT);
  assert.equal(d.settings.activeMediaType, 'video');
  assert.equal(d.settings.videoDim, 18);
}));

test('the interface opens in English, with an optional Sinhala User Guide switch and Sinhala font stack', () => withApp(({ q, w }) => {
  assert.ok(/<html lang="en"/.test(html));
  q.DB.data.settings.lang = 'si';
  q.DB.data.settings.guideLang = 'si';
  q.UI.init();
  assert.equal(q.DB.data.settings.lang, 'en');
  assert.equal(q.DB.data.settings.guideLang, 'en');
  q.UI.openWelcomeGuide();
  const body = w.document.getElementById('guideBody');
  assert.ok(body);
  const tabs = Array.from(body.querySelectorAll('.seg button'));
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].textContent, 'English');
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[1].textContent, 'සිංහල');
  assert.ok(w.document.getElementById('btnGuideStart'));
  assert.ok(hasCss('font-family:"Noto Sans Sinhala","Sinhala Sangam MN","Nirmala UI",Inter,sans-serif!important'));
  assert.ok(has(cssText(), 'line-height:1.72'));
}));

test('HumanVoiceStudio returns no-CORS Oxford word, Youdao phrase and en-GB Google audio candidates', () => withApp(({ q, w }) => {
  const TTS = q.Speech;
  const word = TTS.getStudioMp3Candidates('bicycle', true);
  const phrase = TTS.getStudioMp3Candidates('bus stop', false);
  assert.equal(word[0], OXFORD + 'bicycle--_gb_1.mp3');
  assert.ok(word.some(u => u.indexOf('https://dict.youdao.com/dictvoice?type=1&audio=') === 0));
  assert.ok(word.some(u => u.indexOf('https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-GB&ttsspeed=0.92&q=') === 0));
  assert.equal(phrase[0], 'https://dict.youdao.com/dictvoice?type=1&audio=bus%20stop');
  assert.ok(phrase.some(u => u.indexOf('https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-GB&ttsspeed=0.92&q=bus%20stop') === 0));
  assert.ok(!phrase.some(u => /bus%20stop--_gb_1\.mp3/.test(u)), 'Oxford single-word URLs are not guessed for phrases');
  assert.equal(TTS.getStudioMp3Candidates('tire', true)[0], OXFORD + 'tyre--_gb_1.mp3');
  const audio = TTS.newStudioAudio();
  assert.equal(audio.getAttribute('referrerpolicy'), 'no-referrer');
  assert.equal(audio.getAttribute('crossorigin'), null);
  assert.notEqual(audio.crossOrigin, 'anonymous');
  const live = w.document.getElementById('sdpAudio');
  assert.ok(live);
  assert.equal(live.getAttribute('referrerpolicy'), 'no-referrer');
  assert.equal(live.getAttribute('crossorigin'), null);
  assert.ok(!/\.crossOrigin\s*=\s*["']anonymous/.test(script));
}));

test('session preloading buffers selected word and reaction phrase URLs', () => withApp(({ q }) => {
  const TTS = q.Speech;
  const oldOk = TTS.humanOk;
  const oldCache = TTS.cacheStudioUrl;
  const loaded = [];
  TTS.humanOk = () => true;
  TTS.cacheStudioUrl = url => { loaded.push(url); return true; };
  const count = TTS.preloadSessionWords(['bicycle', 'bus stop']);
  assert.ok(count >= 3);
  assert.ok(loaded.indexOf(OXFORD + 'bicycle--_gb_1.mp3') >= 0);
  assert.ok(loaded.some(url => url.indexOf('https://dict.youdao.com/dictvoice?type=1&audio=bus%20stop') === 0));
  assert.ok(loaded.some(url => url.indexOf('Alright%2C%20listen%20carefully') >= 0));
  TTS.humanOk = oldOk;
  TTS.cacheStudioUrl = oldCache;
}));

test('online live-browser word playback never falls back to OS SpeechSynthesis', () => withApp(({ q, w, clock }) => {
  const TTS = q.Speech;
  let heard = 0, done = false;
  const old = { humanOk: TTS.humanOk, studioActive: TTS.studioActive, isHeadless: TTS.isHeadless, playStudioBeat: TTS.playStudioBeat, supported: TTS.supported };
  TTS.humanOk = () => true;
  TTS.studioActive = () => true;
  TTS.isHeadless = () => false;
  TTS.playStudioBeat = (word, opts, cb) => cb(false);
  TTS.supported = true;
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  w.speechSynthesis = { getVoices: () => [], cancel() {}, speak() { heard++; }, addEventListener() {} };
  TTS.say(['bicycle'], { word: 'bicycle' }, () => { done = true; });
  clock.tick(500);
  assert.equal(done, true);
  assert.equal(heard, 0, 'live failure advances without robotic OS voice');
  TTS.humanOk = old.humanOk;
  TTS.studioActive = old.studioActive;
  TTS.isHeadless = old.isHeadless;
  TTS.playStudioBeat = old.playStudioBeat;
  TTS.supported = old.supported;
}));

test('teacher-repeat prompts and spoken reactions include contextual second pass and feedback choices', () => withApp(({ q }) => {
  const TTS = q.Speech;
  assert.equal(TTS.getHumanRepeatPhrase('bicycle', 0), 'Once more… bicycle.');
  assert.equal(TTS.getHumanRepeatPhrase('train station', 1), 'Listen again, carefully… train station.');
  assert.equal(TTS.getHumanRepeatPhrase('boarding pass', 2), 'One more time… boarding pass.');
  assert.ok(TTS.reactionPhrases.correct.indexOf('Lovely — spot on!') >= 0);
  assert.ok(TTS.reactionPhrases.streak[0].indexOf('brilliant streak') >= 0);
  assert.ok(TTS.reactionPhrases.wrong.some(s => s.indexOf('nearly there') >= 0));
  assert.ok(TTS.reactionPhrases.complete[0].indexOf('session complete') >= 0);
  const oldActive = TTS.studioActive;
  const oldPlay = TTS.playStudioText;
  const played = [];
  TTS.studioActive = () => true;
  TTS.playStudioText = (text, single, done) => { played.push(text); done(true); };
  TTS.speakHumanReaction('correct');
  TTS.speakHumanReaction('streak');
  TTS.speakHumanReaction('wrong');
  TTS.speakHumanReaction('complete');
  assert.equal(played.length, 4);
  assert.ok(played[0].indexOf('spot on') >= 0);
  assert.ok(played[1].indexOf('streak') >= 0);
  assert.ok(played[2].indexOf('nearly there') >= 0 || played[2].indexOf('close one') >= 0);
  assert.ok(played[3].indexOf('session complete') >= 0);
  TTS.studioActive = oldActive;
  TTS.playStudioText = oldPlay;
}));

test('dictation beats retain two repetitions, rate cadence, 850ms breath, five-second timer and Repeat 2 cue', () => withApp(({ q, clock }) => {
  q.Eng.words = [{ w: 'bicycle', s: 'I ride a bicycle to work.' }];
  q.Eng.order = [0];
  q.DB.data.settings.numbers = false;
  q.DB.data.settings.sentence = false;
  q.DB.data.settings.repeats = 2;
  const beats = q.Eng.buildBeats(0);
  const says = beats.filter(b => b.t === 'say');
  assert.equal(says.length, 2);
  assert.equal(says[0].rate, 0.96);
  assert.equal(says[0].repeat, 0);
  assert.equal(says[1].rate, 0.92);
  assert.equal(says[1].repeat, 1);
  assert.equal(beats.filter(b => b.t === 'wait')[0].ms, 850);
  assert.equal(beats[beats.length - 1].t, 'write');
  assert.equal(beats[beats.length - 1].secs, 5);
  const TTS = q.Speech;
  const old = TTS.playStudioText;
  const heard = [];
  TTS.playStudioText = (text, single, done) => { heard.push(text); done(true); };
  let done = false;
  TTS.playStudioBeat('bicycle', { repeat: 1, idx: 4 }, () => { done = true; });
  clock.tick(25);
  assert.equal(done, true);
  assert.deepEqual(heard, ['Once more… bicycle.']);
  heard.length = 0;
  TTS.playStudioBeat('bicycle', { repeat: 0, idx: 0 }, () => {});
  clock.tick(50);
  assert.deepEqual(heard, ['Alright, listen carefully…', 'bicycle']);
  TTS.playStudioText = old;
}));

test('Settings exposes the human-reaction switch, voice presence badge and optional ElevenLabs key field', () => withApp(({ q, w }) => {
  q.Screens.settings();
  const toggle = w.document.getElementById('tHumanReactions');
  const badge = w.document.getElementById('voiceHumanBadgeSettings');
  const key = w.document.getElementById('tElevenLabsKey');
  assert.ok(toggle);
  assert.equal(toggle.getAttribute('role'), 'switch');
  assert.equal(toggle.getAttribute('aria-checked'), 'true');
  assert.ok(badge && badge.className.indexOf('voice-human-badge') >= 0);
  assert.match(w.document.getElementById('voiceHumanBadgeSettings').textContent, /British Studio Voice.*ON/);
  assert.ok(key);
  assert.equal(key.type, 'text');
  key.value = 'test-key';
  key.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(q.DB.data.settings.elevenLabsKey, 'test-key');
  toggle.click();
  assert.equal(q.DB.data.settings.humanReactions, false);
  assert.equal(toggle.getAttribute('aria-checked'), 'false');
  assert.match(badge.textContent, /OFF/);
}));

test('the Dictation Player mounts a separate British Studio Voice presence badge', () => withApp(({ q, w }) => {
  q.Eng.start({});
  const badge = w.document.querySelector('#layers #voiceHumanBadge');
  assert.ok(badge);
  assert.match(badge.textContent, /British Studio Voice/);
  assert.equal(badge.getAttribute('role'), 'status');
  assert.equal(badge.querySelectorAll('.vh-eq i').length, 4);
}));

test('v37 profile migration and resetToV38 force English, paper, Amy, reactions and the bundled video', () => withApp(({ q }) => {
  const old = q.defaultData();
  old.v = 37;
  old.settingsRev = 37;
  old.settings.lang = 'si';
  old.settings.guideLang = 'si';
  old.settings.mode = 'typed';
  old.settings.voice = 'Daniel';
  old.settings.rate = 0.5;
  old.settings.humanReactions = false;
  old.settings.activeVideoSrc = 'https://example.test/outside.mp4';
  old.settings.activeMediaType = 'photo';
  const migrated = q.DB.migrate(old);
  assert.equal(migrated.v, 38);
  assert.equal(migrated.settingsRev, 38);
  assert.equal(migrated.settings.lang, 'en');
  assert.equal(migrated.settings.guideLang, 'en');
  assert.equal(migrated.settings.mode, 'paper');
  assert.equal(migrated.settings.voice, 'Amy');
  assert.equal(migrated.settings.rate, 0.96);
  assert.equal(migrated.settings.humanReactions, true);
  assert.equal(migrated.settings.activeVideoSrc, DEFAULT);
  assert.equal(migrated.settings.activeMediaType, 'video');
  assert.equal(migrated.settings.videoDim, 18);
  const again = q.DB.migrate(migrated);
  assert.equal(again.v, 38);
  assert.equal(again.settings.humanReactions, true);
  assert.equal(typeof q.DB.resetToV38, 'function');
}));

test('Session 7 retains all 30 travel words, five-second writing, x2 repeats and Amy en-GB defaults', () => {
  const list = session.lists.find(item => item.id === 'list_session_7_travel');
  assert.ok(list);
  assert.equal(list.words.length, 30);
  ['guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration', 'journey', 'luggage', 'machine', 'mechanic', 'nationality', 'on business', 'on vacation', 'overnight', 'passenger', 'public transport', 'reception', 'reservation', 'road sign', 'signpost', 'spaceship', 'suitcase', 'tourist information centre', 'traffic lights', 'tunnel', 'tyre/tire', 'vehicle', 'visa', 'waiting room', 'windscreen'].forEach(word => assert.ok(list.words.some(item => item.w === word), word));
  list.words.forEach(item => assert.ok(/_gb_1\.mp3$/.test(item.audio || ''), item.w + ' British clip URL'));
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.rate, 0.96);
  assert.equal(config.session.voice, 'Amy');
  assert.equal(config.session.lang, 'en');
  assert.equal(config.session.guideLang, 'en');
  assert.equal(config.session.humanReactions, true);
});

test('architectural interface keeps its radii, cobalt/graphite palette, white headings and hidden orbs', () => withApp(({ w }) => {
  assert.ok(hasCss('border-radius:10px!important'));
  assert.ok(hasCss('border-radius:11px!important'));
  assert.ok(hasCss('border-radius:12px!important'));
  assert.ok(hasCss('border-radius:16px!important'));
  assert.ok(hasCss('--graphite:rgba(17,24,39,0.88)'));
  assert.ok(hasCss('--panel:rgba(11,15,25,0.72)'));
  assert.ok(hasCss('linear-gradient(180deg,#3b82f6 0,#2563eb 100%)!important'));
  assert.ok(hasCss('*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important'));
  assert.ok(hasCss('--fg:#f8fafc'));
  assert.ok(hasCss('.bg-aurora,.bg-grid,.blob,.bubble,.disc,.hansanaSpot,.orb,.player-backdrop,.player-orb,.ring,.stripes{display:none!important'));
  assert.ok(!hasCss('border-radius:999px'));
  assert.ok(!hasCss('border-radius:99px'));
  assert.ok(!hasCss('background-clip:text'));
  const doc = w.document;
  assert.equal(w.getComputedStyle(doc.getElementById('btnStart')).borderRadius, '10px');
  assert.equal(w.getComputedStyle(doc.getElementById('homeHero')).borderRadius, '16px');
  assert.equal(w.getComputedStyle(doc.getElementById('tabbar')).borderRadius, '16px');
  assert.equal(w.getComputedStyle(doc.querySelector('.seg')).borderRadius, '11px');
}));

test('GPU motion and Hansana credits retain the 0.04s press, 0.22s glide and reveal cycle', () => {
  assert.ok(CSS.indexOf('.16s') >= 0, '0.16 second response transition');
  assert.ok(CSS.indexOf('.04s') >= 0 || CSS.indexOf('40ms!important') >= 0, '0.04 second press feedback');
  assert.ok(CSS.indexOf('.22s') >= 0, '0.22 second screen glide');
  assert.ok(CSS.indexOf('cubic-bezier(.16,1,.3,1)') >= 0);
  assert.ok(CSS.indexOf('#credit{z-index:9999!important') >= 0);
  assert.ok(hasCss('@keyframes hansanaRevealCycle') && CSS.indexOf('opacity:.12') >= 0);
  assert.ok(has(html, 'CREDITS GOES TO'));
  assert.ok(has(html, 'setTimeout(function(){U.setCls(document.body,"credit-intro",!1)},2800)'));
});

test('wallpaper remains an /assets/-only single hardware video with a v38 discovery cache', () => withApp(({ q, w }) => {
  assert.equal(q.DEFAULT_WALLPAPER_SRC, DEFAULT);
  assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
  assert.equal(q.DB.data.settings.activeMediaType, 'video');
  assert.ok(q.isAssetsMedia(DEFAULT));
  assert.equal(q.normalizeAssetPath('https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-live-wallpaper.mp4?v=38#t=1'), DEFAULT);
  assert.equal(q.normalizeAssetPath('./qa/evidence/fatal-390.png'), '');
  assert.equal(w.document.querySelectorAll('#bgLiveVideo').length, 1);
  assert.ok(has(html, 'sdp.gh_assets_v38'));
  assert.ok(has(html, 'ghMediaTtl:9e5'));
  assert.ok(has(html, 'preload="none"'));
  assert.ok(CSS.indexOf('#bgLiveAmbilight{') >= 0 && CSS.indexOf('#bgLiveAmbilight{') < CSS.indexOf('display:none!important', CSS.indexOf('#bgLiveAmbilight{')));
  assert.ok(hasCss('filter:none'));
}));

test('legacy v22-v37 core contracts remain in the v38 single-file app', () => {
  const tokens = [
    '#bgLiveWrap', '#bgLiveAmbilight', '#bgLiveVideo', '#bgLiveCanvas', '#bgContrastScrim', '#bgLivePhoto', '#liveVideoInput',
    'video-gallery-badge', 'syncAmbilight:function(){}', 'playAmbilight:function(){}', 'renderGallery:function', 'previewThumb:function',
    'renderGalleryList:function', 'startPractisingFromGuide', 'cmp-ok', 'cmp-miss', 'streak-broken', 'plTickHero', 'plWrongHero',
    'ansMirrorText', 'ans-caret', 'materialMixer', 'CREDITS GOES TO', 'tire:"tyre"', 'tyre/tire', 'navigator.serviceWorker',
    'sdp_wallpaper_db', 'wake:function', 'sleep:function', 'draw:function', 'rafId:null', '💔 Streak Broken! (0)', 'guide-credit-pill',
    'cancelReadyAndExit', 'ansInput', 'tabInd', 'segSync', 'lgStage', 'hollow', 'sanitiseWallpaper',
    'syncRemote', 'buildSearchIndex', 'searchWords', 'ansCompare', 'Next Wallpaper', 'Refresh from GitHub', 'resetToV33:function',
    'resetToV34:function', 'resetToV35:function', 'resetToV36:function', 'resetToV37:function', 'resetToV38:function',
    'sdp.v37_human_british', 'sdp.v35_rainbow_liquid_glass', 'sdp.v34_highlighted_ui', 'sdp.gh_assets_v38', 'sdp.gh_assets_v37',
    '_loadedSrc', 'adaptPerformance:function', 'gal-preview-btn', 'bindStreamStatus:function', 'recoverVideo:function', 'liteFx:function',
    'markPlaying:function', '?v=38', 'credit-intro', 'hansanaRevealCycle', 'sdpDynamicFonts', 'Noto Sans Sinhala',
    'touch-action:manipulation', 'getHumanBritishAudioUrl', 'pickBritishFemaleVoice', 'humanAudioMap', 'enrichHumanAudio',
    'British Studio Audio · en-GB providers', 'scale(.965) translateZ(0)', 'resetToV37:function'
  ];
  tokens.forEach(token => assert.ok(has(html, token), 'missing preserved feature token: ' + token));
  for (const token of ['backdrop-filter: blur(4px)', 'backdrop-filter:blur(4px)', 'brightness(1.02)', 'blur(4px) saturate(140%)', '#ff3d77', 'transition:all!important', 'background-clip:text']) {
    assert.ok(!has(html, token), 'retired style token returned: ' + token);
  }
});

test('admin PIN, text-mode answer input, IME space sentinel and no password field remain', () => withApp(({ q, w }) => {
  assert.equal(require('./test-pin.cjs'), '7898');
  assert.ok(has(html, '#pinPad'));
  assert.ok(has(html, 'pinSalt') && has(html, 'pinHash'));
  assert.ok(!has(html, 'inp.type="password"'));
  assert.ok(has(html, 'ccHoneypot'));
  q.DB.data.settings.mode = 'type';
  q.Eng.start({ mode: 'type' });
  const input = w.document.getElementById('ansInput');
  assert.ok(input);
  assert.equal(input.type, 'text');
  assert.equal(input.autocomplete, 'off');
  assert.equal(input.value, ' ');
}));

test('all bundled media stays under its size budget and inside /assets/', () => {
  assert.ok(fs.existsSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')));
  assert.ok(fs.existsSync(path.join(root, 'assets', 'bunny-poster.webp')));
  assert.ok(fs.statSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')).size < 3 * 1024 * 1024);
  assert.ok(fs.statSync(path.join(root, 'assets', 'bunny-poster.webp')).size < 64 * 1024);
  const media = html.match(/\.\/[A-Za-z0-9_\-./]+\.(mp4|webm|mov|m4v|webp|jpe?g|png|mp3)/g) || [];
  media.forEach(item => assert.ok(item.indexOf('./assets/') === 0, 'media outside /assets/: ' + item));
});

test('low-end performance safeguards and runtime font loading remain headless-safe', () => {
  assert.ok(has(html, 'liteFx:function') && has(html, 'addRing:function'));
  assert.ok(has(html, 'passive:!0'));
  assert.ok(has(html, 'U.on(document,"visibilitychange"'));
  assert.ok(has(html, 'adaptPerformance:function'));
  assert.ok(has(html, 'prefers-reduced-motion') || hasCss('@media (prefers-reduced-motion:reduce)'));
  assert.ok(has(html, 'requestIdleCallback') || has(html, 'frameProbe'));
  assert.ok(has(html, 'HeadlessChrome') && has(html, 'navigator.onLine'));
});
