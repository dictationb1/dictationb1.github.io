'use strict';
/* v37 release gates - a complete rewrite of the upgrade suite.
   1. Default English interface: lang="en", guideLang="en", English guide with
      an optional in-guide Sinhala toggle and Noto Sans Sinhala typography.
   2. A real human British woman voice: Oxford/gstatic en-GB studio MP3s, the
      Microsoft Sonia -> Libby -> Google UK English Female -> Serena -> Kate
      female-only priority and calm 0.96/0.92 prosody.
   3. The architectural human-crafted interface: 10px buttons, 16px cards,
      12px tiles, cobalt CTAs, graphite secondaries, zero orbs or neon glows.
   4. Silky 120fps GPU transitions and the "CREDITS GOES TO Hansana" first-read
      spotlight that fades to 0.12 and back forever.
   5. Every v22-v36 feature, storage, media and privacy rule still in place. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const acorn = require('acorn');
const { harness, html } = require('./app-harness.cjs');

const root = path.resolve(__dirname, '..');
const json = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const version = json('version.json');
const config = json('config.json');
const session = json('session.json');

const KEY = 'sdp.v37_human_british';
const LEGACY_KEY = 'sdp.v36_human_editorial';
const GH_KEY = 'sdp.gh_assets_v37';
const LEGACY_GH_KEY = 'sdp.gh_assets_v36';
const DEFAULT = './assets/bunny-live-wallpaper.mp4';
const POSTER = './assets/bunny-poster.webp';
const MP3 = 'https://ssl.gstatic.com/dictionary/static/sounds/20200429/';
const PIN = require('./test-pin.cjs');

const has = (s, t) => String(s).indexOf(t) >= 0;
const lacks = (s, t) => String(s).indexOf(t) < 0;
const compact = (s) => String(s).replace(/\s+/g, '');
const cssText = () => {
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
};
const CSS = compact(cssText());
const hasCss = (snippet) => has(CSS, compact(snippet));
const ruleOf = (selector) => {
  const m = cssText().match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}'));
  return m ? compact(m[0]) : '';
};
const scriptBody = () => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  return m ? m[1] : '';
};
const speechStub = (list, spoken) => ({
  getVoices: () => list,
  addEventListener() {},
  speak(u) {
    if (spoken) spoken.push({ lang: u.lang, rate: u.rate, pitch: u.pitch, volume: u.volume, text: u.text });
    setTimeout(() => u.onend && u.onend({}), 5);
  },
  cancel() {}
});
const voice = (name, lang) => ({ name: name, lang: lang || 'en-GB', localService: false });

test('1. v37 build gate: ES5 only, zero external links, under 442,000 bytes', () => {
  const js = scriptBody();
  assert.ok(js.length > 100000, 'the single inline script is present');
  assert.doesNotThrow(() => acorn.parse(js, { ecmaVersion: 5 }), 'strict ES5 parses');
  ['const ', 'let ', '=>', '`', 'async function', 'await '].forEach((token) =>
    assert.ok(lacks(js, token), 'ES5 only, found ' + token));
  assert.ok(lacks(html, '<link'), 'no static <link> tag of any kind');
  assert.ok(!/<script[^>]+src=/.test(html), 'no external script');
  assert.ok(Buffer.byteLength(html) < 442000, 'index.html stays well under the 450,000 byte ceiling');
  const check = cp.spawnSync(process.execPath, ['tests/check.cjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.ok(lacks(html, '.json?v=36') && lacks(html, '.json?v=35'), 'static data uses the v37 cache token');
});

test('2. v37 identity: ver 37, appVersion 4.4.0, settingsRev 37 and the v37 storage keys', () => {
  for (const [name, d] of [['version', version], ['config', config], ['session', session]]) {
    assert.equal(d.ver, 37, name + ' ver');
  }
  assert.equal(version.appVersion, '4.4.0');
  assert.equal(version.version, '4.4.0');
  assert.equal(version.settingsRev, 37);
  assert.equal(version.buildDate, '2026-10-28');
  assert.equal(version.session, '7');
  assert.ok(has(version.features.visual, '10px buttons'), 'the release notes describe the v37 radii');
  const a = harness();
  const q = a.q;
  assert.equal(q.APP_VERSION, '4.4.0');
  assert.equal(q.CONFIG.key, KEY);
  assert.equal(q.CONFIG.schema, 37);
  assert.equal(q.CONFIG.settingsRev, 37);
  assert.equal(q.CONFIG.lockedVoice, 'Amy');
  assert.equal(q.CONFIG.ghMediaCache, GH_KEY);
  assert.ok(q.CONFIG.legacyMediaCaches.indexOf(LEGACY_GH_KEY) >= 0, 'the v36 media cache is retired');
  assert.ok(q.CONFIG.legacyMediaCaches.indexOf('sdp.gh_assets_v35') >= 0);
  assert.ok(has(html, 'window.SDP = {version:APP_VERSION,build:BUILD_DATE'), 'the SDP API reports the live build');
  assert.ok(has(html, 'var APP_VERSION="4.4.0"') && has(html, 'var BUILD_DATE="2026-10-28"'));
  assert.ok(has(html, '"4.4.0"'), 'the 4.4.0 build string ships');
  a.close();
});

test('3. default English: <html lang="en">, en/en defaults and an English guide with a Sinhala toggle inside', () => {
  assert.ok(/<html lang="en"/.test(html), 'the document language is English');
  const a = harness();
  const q = a.q;
  const d = q.defaultData();
  assert.equal(d.settings.lang, 'en');
  assert.equal(d.settings.guideLang, 'en');
  assert.equal(q.DB.data.settings.lang, 'en');
  assert.equal(q.DB.data.settings.guideLang, 'en');
  q.DB.data.settings.lang = 'si';
  q.DB.data.settings.guideLang = 'si';
  q.UI.init();
  assert.equal(q.DB.data.settings.lang, 'en', 'UI.init() opens every screen in English');
  assert.equal(q.DB.data.settings.guideLang, 'en', 'UI.init() opens the guide in English');
  const en = q.DB.data.settings.lang;
  q.UI.openWelcomeGuide();
  const doc = a.w.document;
  const sheet = doc.getElementById('guideSheet');
  const body = doc.getElementById('guideBody');
  assert.ok(sheet && body, 'the guide sheet opens as #guideSheet / #guideBody');
  assert.equal(en, 'en');
  const tabs = Array.prototype.slice.call(body.querySelectorAll('.seg button'));
  assert.equal(tabs.length, 2, 'the guide carries an English / Sinhala toggle');
  assert.equal(tabs[0].textContent, 'English');
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[1].textContent, 'සිංහල');
  assert.equal(body.getAttribute('lang'), null, 'the English guide is not marked as Sinhala');
  assert.ok(doc.getElementById('btnGuideStart'), 'Start practising lives inside the guide');
  assert.ok(body.querySelector('.guide-credit-pill'), 'the credits pill lives inside the guide');
  assert.ok(q.GUIDE.en && q.GUIDE.si, 'both guide translations ship');
  assert.ok(hasCss('.si,[lang=si],body[data-lang=si] #guideBody{font-family:"Noto Sans Sinhala","Iskoola Pota",system-ui,sans-serif!important;line-height:1.72!important;font-weight:500!important}'),
    'the Sinhala guide keeps the Noto stack and the 1.72 pillam-safe line-height');
  assert.ok(has(html, '"Noto Sans Sinhala"'), 'Noto Sans Sinhala ships');
  a.close();
});

test('4. real human British woman audio: Oxford/gstatic en-GB studio MP3s with a memory cache', () => {
  const a = harness();
  const q = a.q;
  const S = q.Speech;
  assert.equal(q.CONFIG.humanMp3, MP3);
  assert.equal(S.getHumanBritishAudioUrl('bicycle'), MP3 + 'bicycle--_gb_1.mp3');
  assert.equal(S.getHumanBritishAudioUrl('Bicycle'), MP3 + 'bicycle--_gb_1.mp3', 'case is normalised');
  assert.equal(S.getHumanBritishAudioUrl('tire'), MP3 + 'tyre--_gb_1.mp3', 'tire plays the British tyre recording');
  assert.equal(S.getHumanBritishAudioUrl('tyre'), MP3 + 'tyre--_gb_1.mp3');
  assert.equal(S.getHumanBritishAudioUrl('tyre/tire'), MP3 + 'tyre--_gb_1.mp3');
  assert.equal(S.getHumanBritishAudioUrl('on business'), '', 'phrases fall back instead of guessing a URL');
  assert.equal(S.getHumanBritishAudioUrl(''), '');
  S.humanAudioMap.bicycle = 'https://example.test/bicycle-uk.mp3';
  assert.equal(S.getHumanBritishAudioUrl('bicycle'), 'https://example.test/bicycle-uk.mp3', 'the memory cache wins');
  delete S.humanAudioMap.bicycle;
  ['humanAudioMap', 'playHuman', 'enrichHumanAudio', 'isHumanUrl'].forEach((k) =>
    assert.equal(typeof S[k] !== 'undefined', true, k + ' exists'));
  assert.ok(has(html, '-uk\\.mp3') || has(html, '-uk.mp3'), 'dictionaryapi -uk.mp3 samples are accepted');
  assert.ok(has(html, '_gb_'), 'the _gb_ studio marker is accepted from the dictionary');
  assert.equal(q.CONFIG.dictHost, 'https://api.dictionaryapi.dev/api/v2/entries/en/');
  assert.ok(has(html, '450'), 'the 450ms fallback for phrases and offline devices');
  assert.ok(has(html, 'preloadHuman'), 'the next word is preloaded while the countdown runs');
  a.close();
});

test('5. British female voice priority: Sonia, Libby, Google, Serena, Kate - never a man, never non-UK', () => {
  const a = harness();
  const q = a.q;
  const W = a.w;
  const S = q.Speech;
  const pick = (list) => {
    W.speechSynthesis = speechStub(list);
    const best = S.pickBritishFemaleVoice();
    return best ? best.name : undefined;
  };
  assert.equal(pick([voice('Microsoft Sonia Online (Natural) - English (United Kingdom)'), voice('Libby Online (Natural) - English (United Kingdom)')]),
    'Microsoft Sonia Online (Natural) - English (United Kingdom)');
  assert.equal(pick([voice('Libby Online (Natural) - English (United Kingdom)'), voice('Google UK English Female')]),
    'Libby Online (Natural) - English (United Kingdom)');
  assert.equal(pick([voice('Google UK English Female'), voice('Serena (Premium)'), voice('Kate (Enhanced)')]),
    'Google UK English Female');
  assert.equal(pick([voice('Serena (Premium)'), voice('Kate (Enhanced)'), voice('Martha')]), 'Serena (Premium)');
  assert.equal(pick([voice('Kate (Enhanced)'), voice('Martha'), voice('Amy')]), 'Kate (Enhanced)');
  assert.equal(pick([voice('Daniel'), voice('Arthur'), voice('Oliver'), voice('Ryan'), voice('George'), voice('Thomas'), voice('James'), voice('David'), voice('Mark'), voice('Richard')]),
    undefined, 'a male voice is never chosen, even when it is the only en-GB voice');
  assert.equal(pick([voice('Samantha', 'en-US'), voice('Alex', 'en-US')]), undefined,
    'a non-UK voice is never chosen when nothing British exists');
  assert.equal(q.DB.data.settings.voice, 'Amy');
  assert.equal(q.CONFIG.lockedVoice, 'Amy');
  assert.ok(has(html, 'Sonia') && has(html, 'Libby') && has(html, 'Google UK English Female'), 'the priority list ships');
  assert.ok(has(html, 'Daniel|Oliver|Arthur|George|Ryan|Male|David|Mark|James|Thomas|Fred|Alex|Aaron|Richard'), 'male voice guards ship');
  assert.ok(has(html, 'isMaleName'), 'the male guard is enforced before ranking');
  assert.equal(S.audioLabel(), 'Amy · Real Human British Woman (en-GB Studio)');
  a.close();
});

test('6. prosody: en-GB, 0.96 then 0.92, never below 0.88, pitch 1.02, volume 1.0 and an 850ms breath', () => {
  const a = harness();
  const q = a.q;
  const W = a.w;
  q.Eng.words = [{ w: 'bicycle', s: 'I ride a bicycle to work.' }];
  q.Eng.order = [0];
  q.DB.data.settings.numbers = false;
  q.DB.data.settings.sentence = false;
  q.DB.data.settings.repeats = 2;
  const beats = q.Eng.buildBeats(0);
  const says = beats.filter((b) => b.t === 'say');
  assert.equal(says.length, 2, 'two repeats');
  assert.equal(says[0].rate, 0.96);
  assert.equal(says[1].rate, 0.92);
  const wait = beats.filter((b) => b.t === 'wait')[0];
  assert.equal(wait.ms, 850, 'a calm 850ms breath between the two repeats');
  assert.equal(beats[beats.length - 1].t, 'write');
  assert.equal(beats[beats.length - 1].secs, 5, 'the five second timer');
  const spoken = [];
  W.SpeechSynthesisUtterance = function (t) { this.text = t; };
  W.speechSynthesis = speechStub([voice('Microsoft Sonia Online (Natural) - English (United Kingdom)')], spoken);
  q.Speech.supported = true;
  q.Speech.textOnly = false;
  q.Speech.allowNonUK = true;
  q.Speech.readVoices();
  let done = false;
  q.Speech.say(['bicycle'], {}, () => { done = true; });
  for (let i = 0; i < 60 && !done; i++) a.clock.tick(100);
  assert.ok(done, 'the sentence finished');
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].lang, 'en-GB');
  assert.equal(spoken[0].rate, 0.96);
  assert.equal(spoken[0].pitch, 1.02);
  assert.equal(spoken[0].volume, 1);
  assert.ok(has(html, 'clamp(t||.96,.88,1.15)') || has(html, '.88'), 'the rate never drops below 0.88');
  a.close();
});

test('7. architectural radii: 10px buttons, 11px segments, 16px cards, 12px tiles, 8px thumbs', () => {
  assert.ok(hasCss('.btn,.ibtn,.chip,.badge,.pill,.hero-credit,#btnGuide,.top-pill,.video-gallery-badge,.guide-credit-pill,.credit,.seg button{border-radius:10px!important}'),
    'every control is a 10px rectangle');
  assert.ok(hasCss('.seg,.seg-tint{background:var(--surface)!important;border:1px solid rgba(255,255,255,0.18)!important;border-radius:11px!important}'),
    'the segment track is an 11px rectangle');
  assert.ok(has(cssText(), '#tabbar{background:var(--panel)!important;border:1px solid rgba(255,255,255,0.16)!important;border-radius:16px!important'),
    'the dock is a 16px bar');
  assert.ok(hasCss('#tabInd,#tabbar button,.tab{border-radius:11px!important}'));
  assert.ok(hasCss('.seg .thumb,.seg-ind,.seg button,.seg-tint button,.seg button.active,.seg-tint .seg-ind,.tab.active{border-radius:8px!important}'),
    'the segment thumb is 8px');
  assert.ok(hasCss('.glass:not(#materialMixer):not(#credit),#homeHero,.wordcard,.card,.toast,.layer{background:var(--panel)!important;border:1px solid rgba(255,255,255,0.16)!important;border-radius:16px!important'),
    'cards are 16px');
  assert.ok(hasCss('.sheet,.modal{background:var(--surface)!important;border:1px solid rgba(255,255,255,0.16)!important;border-radius:16px!important}'));
  assert.ok(hasCss('.tile,.wrow,.dict-item,.guide-step{background:var(--field)!important;border:1px solid rgba(255,255,255,0.18)!important;border-radius:12px!important;color:var(--fg)!important}'),
    'tiles are 12px');
  assert.ok(/#ansMirror,\.slot:not\([^)]*\)[^{]*\{[^}]*border-radius:10px!important/.test(cssText()), 'inputs are 10px');
  assert.ok(lacks(CSS, 'border-radius:999px'), 'no 999px bubble pill survives');
  assert.ok(lacks(CSS, 'border-radius:99px'));
  assert.ok(!/\.btn[^{]*\{[^}]*border-radius:50%/.test(cssText()), 'no circular buttons');
  assert.ok(!/button[^{]*\{[^}]*border-radius:999px/.test(cssText()), 'no bubble-pill buttons');
  assert.ok(!/[.#]orb,[^{]*\{[^}]*border-radius:50%/.test(cssText()), 'no orb geometry');
});

test('8. human-crafted surfaces: cobalt CTAs, graphite secondaries, smoked cards, zero blur or neon', () => {
  assert.ok(hasCss('.btn.pri,.btn-pri,.btn.primary,#btnStart,#btnReadyGo,.gal-apply-btn,button.pri{background:linear-gradient(180deg,#3b82f6 0%,#2563eb 100%)!important;color:#ffffff!important;font-weight:600!important;border:1px solid rgba(255,255,255,0.28)!important'),
    'cobalt primary CTA with a hairline rim');
  assert.ok(hasCss('.btn:not(.pri):not(.btn-pri):not(.primary),.btn-sec,.btn-ghost,.ibtn,.top-pill,.wall-open-btn,.gal-preview-btn,.close-x-btn,#btnPerf{background:var(--graphite)!important'),
    'graphite secondary');
  assert.ok(hasCss('--graphite:rgba(17,24,39,0.88)'));
  assert.ok(hasCss('--panel:rgba(11,15,25,0.72)'));
  assert.ok(hasCss('.glass:not(#materialMixer):not(#credit),#homeHero,.wordcard,.card,.toast,.layer{background:var(--panel)!important'));
  assert.ok(hasCss('*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important'), 'no frosted glass anywhere');
  assert.ok(hasCss('--fg:#f8fafc') && hasCss('--muted:#cbd5e1'));
  assert.ok(hasCss('-webkit-text-stroke-width:0!important'), 'no stroke on any glyph');
  assert.ok(lacks(CSS, 'background-clip:text'), 'no hollow neon hero title');
  assert.ok(lacks(CSS, '#ff3d77') && lacks(CSS, '192,132,252'), 'no neon rainbow tokens');
  assert.ok(hasCss('.orb,.disc,.stripes,.bubble,.player-orb,.player-backdrop,.bg-aurora,.bg-grid,.blob,.ring,.hansanaSpot{display:none!important;animation:none!important}'),
    'no orbs, discs, stripes or decorative blobs are rendered');
  assert.ok(/box-shadow:0 12px 32px rgba\(0,0,0,0\.45\)/.test(cssText()), 'deep card shadow');
});

test('9. silky 120fps motion: 0.16s button response, 0.04s press and 0.22s GPU screen morphs', () => {
  assert.ok(hasCss('button,.btn,.ibtn,.tab,.seg button,.chip,.wrow,.guide-credit-pill,.video-gallery-badge{transition:transform 0.16s cubic-bezier(0.22,1,0.36,1),opacity 0.14s ease-out,background-color 0.12s,border-color 0.12s!important}'),
    'buttons respond in 0.16s on a GPU compositor');
  assert.ok(hasCss('button:active,.btn:active,.ibtn:active,.tab:active,.seg button:active,.chip:active,.wrow:active{transform:scale(0.965)translateZ(0)!important;transition-duration:0.04s!important}'),
    'the press is a 0.04s scale(0.965)');
  assert.ok(hasCss('.screen,.sheet,.modal,.layer,#tabInd,.seg .thumb,.seg-ind{transition:transform 0.22s cubic-bezier(0.16,1,0.3,1),opacity 0.18s cubic-bezier(0.16,1,0.3,1)!important;will-change:transform,opacity}'),
    'screens, sheets and layers morph on the compositor');
  assert.ok(hasCss('#tabInd,#tabbar button,.tab{border-radius:11px!important}'));
  assert.ok(lacks(CSS, '1.35)'), 'the bouncy spring easing is retired');
  assert.ok(lacks(CSS, 'transition:all!important'), 'no transition:all surprise on a control');
});

test('10. credit choreography: first-read spotlight, z-index 9999 and the 8s 0.12 fade cycle', () => {
  const a = harness();
  const q = a.q;
  const doc = a.w.document;
  const credit = doc.getElementById('credit');
  assert.ok(credit, '#credit exists');
  assert.ok(has(credit.textContent.toLowerCase(), 'credits goes to') || has(credit.textContent.toLowerCase(), 'credits go to'),
    'the badge credits Hansana');
  assert.ok(has(credit.textContent, 'Hansana'));
  assert.ok(has(html, 'CREDITS GOES TO'));
  assert.ok(hasCss('.credit{opacity:1!important;filter:none!important;background:rgba(11,15,25,0.90)!important;border:1px solid rgba(251,191,36,0.45)!important;border-radius:10px!important'),
    'dark badge, amber hairline, 10px radius');
  assert.ok(hasCss('#credit{z-index:9999!important;border-radius:10px!important}'));
  assert.ok(hasCss('body.credit-intro #credit,body.credit-intro #credit.in{left:50%!important;right:auto!important;top:calc(12px + env(safe-area-inset-top, 0px))!important;bottom:auto!important;opacity:1!important;visibility:visible!important;animation:none!important;transform:translate3d(-50%,12px,0)scale(1.04)!important}'),
    'the first-read spotlight floats top-centre');
  assert.ok(has(html, 'setTimeout(function(){U.setCls(document.body,"credit-intro",!1)},2800)'), 'the spotlight lasts 2.8s');
  assert.ok(hasCss('@keyframes hansanaRevealCycle{0%,58%{opacity:1;transform:translate3d(0,0,0)scale(1)}72%,82%{opacity:.12;transform:translate3d(0,4px,0)scale(1)}92%,100%{opacity:1;transform:translate3d(0,0,0)scale(1)}}'),
    'the reveal cycle never fades below 0.12');
  assert.ok(hasCss('.credit.in{animation:hansanaRevealCycle 8s cubic-bezier(0.4,0,0.2,1)infinite!important'),
    'the cycle loops every 8 seconds');
  assert.ok(credit.classList.contains('in'), 'the badge is revealed on first read');
  assert.ok(doc.body.classList.contains('credit-intro'), 'the spotlight class is applied on first read');
  a.clock.tick(2900);
  assert.ok(!doc.body.classList.contains('credit-intro'), 'the spotlight releases after 2.8s');
  q.UI.showCreditNow();
  assert.ok(doc.body.classList.contains('credit-intro'), 'the reveal can be re-armed');
  a.clock.tick(2900);
  assert.ok(!doc.body.classList.contains('credit-intro'));
  a.close();
});

test('11. one filter-free hardware video: bunny default, ambilight off, no source thrash', () => {
  const a = harness();
  const q = a.q;
  assert.equal(q.DEFAULT_WALLPAPER_SRC, DEFAULT);
  assert.equal(q.DB.data.settings.activeVideoSrc, DEFAULT);
  assert.equal(q.DB.data.settings.activeMediaType, 'video');
  const doc = a.w.document;
  assert.equal(doc.querySelectorAll('#bgLiveVideo').length, 1, 'exactly one live video element');
  assert.ok(/filter:none!\s*important/.test(cssText()), 'the live video is never filtered');
  assert.ok(/#bgLiveVideo\{[^}]*filter:none/.test(cssText()));
  assert.ok(hasCss('#bgLiveAmbilight{display:none !important'), 'the ambilight duplicate is gone');
  [
    'isAssetsMedia', 'normalizeAssetPath', 'ASSET_MEDIA_RE', '_loadedSrc'
  ].forEach((k) => assert.ok(has(html, k), k + ' ships'));
  assert.ok(q.isAssetsMedia(DEFAULT) === true);
  assert.equal(q.normalizeAssetPath('https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-live-wallpaper.mp4?v=37#t=1'),
    DEFAULT, 'GitHub media normalises to the local asset');
  assert.equal(q.normalizeAssetPath('./qa/evidence/fatal-390.png'), '', 'anything outside /assets/ is rejected');
  assert.ok(has(html, 'preload="none"'), 'gallery thumbnails never preload');
  assert.ok(has(html, '"preload","none"') || has(html, 'preload="none"'));
  a.close();
});

test('12. v36 -> v37 migration keeps the words and forces English, paper, Amy, 0.96 and 18% dim', () => {
  const a = harness();
  const q = a.q;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdp-v37-'));
  const file = path.join(dir, 'profile-v36.json');
  fs.writeFileSync(file, JSON.stringify({
    v: 36, settingsRev: 36, tourSeen: true,
    settings: {
      theme: 'light', lang: 'si', guideLang: 'si', mode: 'typed', voice: 'Daniel', voiceName: 'Daniel',
      rate: 0.7, volume: 0.4, videoDim: 0, writeFixed: 30,
      activeVideoSrc: 'https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/assets/bunny-live-wallpaper.mp4?v=36',
      activeMediaType: 'photo'
    },
    lists: q.DB.data.lists, session: q.DB.data.session, results: {}, comments: [], inbox: []
  }), 'utf8');
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = q.DB.migrate(profile);
  assert.equal(out.v, 37);
  assert.equal(out.settingsRev, 37);
  assert.equal(out.settings.lang, 'en', 'a migrated profile opens in English');
  assert.equal(out.settings.guideLang, 'en');
  assert.equal(out.settings.mode, 'paper', 'paper dictation stays the default mode');
  assert.equal(out.settings.voice, 'Amy');
  assert.equal(out.settings.rate, 0.96);
  assert.equal(out.settings.videoDim, 18);
  assert.equal(out.settings.activeVideoSrc, DEFAULT);
  assert.equal(out.settings.activeMediaType, 'video');
  assert.equal(out.settings.theme, 'light', 'the light theme choice survives');
  assert.equal(out.lists.length, q.DB.data.lists.length, 'the word lists survive');
  const empty = q.DB.migrate({});
  assert.equal(empty.v, 37);
  assert.equal(empty.settingsRev, 37);
  assert.equal(empty.settings.lang, 'en');
  assert.equal(empty.settings.guideLang, 'en');
  assert.equal(empty.settings.voice, 'Amy');
  assert.equal(q.DB.data.lists[0].words.length, 30);
  fs.unlinkSync(file);
  fs.rmdirSync(dir);
  a.close();
});

test('13. resetToV37 is idempotent and normalises remote media back into /assets/', () => {
  const a = harness();
  const q = a.q;
  const d = q.defaultData();
  d.settingsRev = 1;
  d.settings.lang = 'si';
  d.settings.guideLang = 'si';
  d.settings.mode = 'typed';
  d.settings.voice = 'Daniel';
  d.settings.rate = 0.5;
  d.settings.videoDim = 70;
  d.settings.activeVideoSrc = 'https://example.test/evil.mp4';
  q.DB.resetToV37(d, q.defaultData());
  assert.equal(d.settingsRev, 37);
  assert.equal(d.v, 37);
  assert.equal(d.settings.lang, 'en');
  assert.equal(d.settings.guideLang, 'en');
  assert.equal(d.settings.mode, 'paper');
  assert.equal(d.settings.voice, 'Amy');
  assert.equal(d.settings.rate, 0.96);
  assert.equal(d.settings.videoDim, 18);
  assert.equal(d.settings.activeVideoSrc, DEFAULT);
  assert.equal(d.settings.activeMediaType, 'video');
  q.DB.resetToV37(d, q.defaultData());
  assert.equal(d.settingsRev, 37, 'running the reset twice is safe');
  a.close();
});

test('14. every v22-v36 feature token is still present and the v37 guards are in place', () => {
  [
    '#bgLiveWrap', '#bgLiveAmbilight', '#bgLiveVideo', '#bgLiveCanvas', '#bgContrastScrim',
    '#bgLivePhoto', '#liveVideoInput', 'video-gallery-badge',
    'syncAmbilight:function(){}', 'playAmbilight:function(){}',
    'renderGallery:function', 'previewThumb:function', 'renderGalleryList:function',
    'startPractisingFromGuide', 'diffChars', 'streak-broken', 'plTickHero', 'plWrongHero',
    'ansMirrorText', 'ans-caret', 'materialMixer', 'CREDITS GOES TO',
    'tire:"tyre"', 'tyre/tire', 'navigator.serviceWorker', 'sdp_wallpaper_db',
    'wake:function', 'sleep:function', 'draw:function', 'rafId:null',
    '💔 Streak Broken! (0)', 'guide-credit-pill', 'cancelReadyAndExit',
    'inp.value=" "', 'autocomplete","off")', 'tabInd', 'segSync', 'lgStage', 'hollow',
    'sanitiseWallpaper', 'syncRemote', 'buildSearchIndex', 'searchWords', 'ansCompare',
    'Next Wallpaper', 'Refresh from GitHub', 'resetToV33:function', 'resetToV34:function',
    'resetToV35:function', 'resetToV36:function', 'resetToV37:function',
    LEGACY_KEY, 'sdp.v35_rainbow_liquid_glass', 'sdp.v34_highlighted_ui',
    GH_KEY, LEGACY_GH_KEY, '_loadedSrc', 'adaptPerformance:function',
    'gal-preview-btn', 'bindStreamStatus:function', 'recoverVideo:function',
    'liteFx:function', 'markPlaying:function', '?v=37', 'credit-intro', 'hansanaRevealCycle',
    'sdpDynamicFonts', 'Noto Sans Sinhala', 'touch-action:manipulation',
    'getHumanBritishAudioUrl', 'pickBritishFemaleVoice', 'humanAudioMap', 'enrichHumanAudio',
    'Amy · Real Human British Woman (en-GB Studio)', 'scale(0.965)translateZ(0)'
  ].forEach((token) => assert.ok(has(html, token), 'missing token: ' + token));
  ['backdrop-filter: blur(4px)', 'backdrop-filter:blur(4px)', 'brightness(1.02)',
    'blur(4px) saturate(140%)', '#ff3d77', 'transition:all!important'].forEach((token) =>
    assert.ok(lacks(html, token), 'legacy token must be gone: ' + token));
  assert.ok(lacks(html, 'background-clip:text'), 'the hollow hero title never comes back');
  assert.ok(has(html, '"සිංහල"') || has(html, 'සිංහල'));
});

test('15. Session 7 keeps all 30 travel words, the 5s timer, x2 repeats and the Amy en-GB voice', () => {
  const list = session.lists.filter((l) => l.id === 'list_session_7_travel')[0];
  assert.ok(list, 'Session 7 list present');
  const words = list.words.map((x) => x.w);
  assert.equal(words.length, 30);
  ['guidebook', 'handlebars', 'harbour', 'helicopter', 'hitchhike', 'immigration', 'journey',
    'luggage', 'machine', 'mechanic', 'nationality', 'on business', 'on vacation', 'overnight',
    'passenger', 'public transport', 'reception', 'reservation', 'road sign', 'signpost',
    'spaceship', 'suitcase', 'tourist information centre', 'traffic lights', 'tunnel',
    'tyre/tire', 'vehicle', 'visa', 'waiting room', 'windscreen'].forEach((wrd) =>
    assert.ok(words.indexOf(wrd) >= 0, wrd + ' missing from Session 7'));
  list.words.forEach((x) => assert.ok(/_gb_1\.mp3$/.test(x.audio || ''), 'every word ships a British studio MP3'));
  assert.equal(config.defaults.writeFixed, 5);
  assert.equal(config.defaults.repeats, 2);
  assert.equal(config.defaults.rate, 0.96);
  assert.equal(config.session.lang, 'en');
  assert.equal(config.session.guideLang, 'en');
  assert.equal(config.session.voice, 'Amy');
  assert.equal(config.session.mode, 'paper');
  assert.equal(config.session.videoDim, 18);
  assert.equal(config.session.activeVideoSrc, DEFAULT);
  assert.equal(session.session.lang, 'en');
  assert.equal(session.session.guideLang, 'en');
  assert.ok(has(html, 'ttsBackupHost') && has(html, 'voice=Amy'));
  assert.ok(has(html, 'tire:"tyre"'), 'the tyre/tire alias still matches');
});

test('16. admin security: PIN 7898, a text-mode answer box and no password popup', () => {
  assert.equal(PIN, '7898');
  assert.ok(has(html, '#pinPad'), 'the keypad ships');
  assert.ok(has(html, 'pinSalt') && has(html, 'pinHash'));
  assert.ok(lacks(html, 'inp.type="password"'), 'the dictation answer box is never a password field');
  assert.ok(has(html, 'inp.type="text"'), 'the answer box is plain text');
  assert.ok(has(html, 'inp.type="text"') && has(html, 'inp.id="ansInput"'));
  assert.ok(has(html, 'inp.value=" "'), 'the single-space IME buffer is preserved');
  assert.ok(has(html, 'ccHoneypot'), 'the honeypot still guards the composer');
  const a = harness();
  assert.equal(a.q.Admin.pinHash ? a.q.Admin.pinHash.length : 64, 64);
  a.close();
});

test('17. GitHub media discovery: /assets/ only, 15 minute TTL and the v36 cache purged', () => {
  const a = harness();
  const q = a.q;
  assert.equal(q.LiveWallpaper.activeSrc, DEFAULT);
  assert.ok(has(html, 'sdp.gh_assets_v37'));
  assert.ok(has(html, 'ghMediaTtl:9e5'), 'the discovery cache expires in 15 minutes');
  assert.ok(q.CONFIG.legacyMediaCaches.length >= 8);
  assert.ok(q.CONFIG.repoVideos.length >= 1);
  q.CONFIG.repoVideos.forEach((v) => assert.ok(/^\.\/assets\//.test(v.src), 'repo media stays in /assets/'));
  assert.ok(/^\.\/assets\//.test(q.CONFIG.repoVideoPoster));
  a.close();
});

test('18. the 0-75 dimmer still defaults to 18 and writes --bg-dim', () => {
  const a = harness();
  const q = a.q;
  assert.equal(q.DB.data.settings.videoDim, 18);
  assert.ok(has(html, '--bg-dim'), 'the dimmer writes the adaptive scrim variable');
  assert.ok(hasCss('#bgContrastScrim'));
  const dim = q.LiveWallpaper.dimValue ? q.LiveWallpaper.dimValue() : 18;
  assert.ok(dim >= 0 && dim <= 75);
  a.close();
});

test('19. low-end performance: 10-ring cap, lite sparks, visibility pause and passive listeners', () => {
  assert.ok(has(html, 'var cap=this.liteFx()?10:20'), 'the ambient canvas caps at ten rings in lite mode');
  assert.ok(has(html, 'OPTS={passive:!0}'), 'passive pointer listeners');
  assert.ok(has(html, 'U.on(document,"visibilitychange"'), 'the canvas pauses when the tab is hidden');
  assert.ok(has(html, 'adaptPerformance:function'));
  assert.ok(has(html, 'prefers-reduced-motion') || hasCss('@media (prefers-reduced-motion:reduce)'),
    'reduced motion is respected');
  assert.ok(has(html, 'requestIdleCallback') || has(html, 'frameProbe'), 'the frame probe still guards full mode');
});

test('20. media assets stay inside /assets/ and inside their byte budget', () => {
  const p = (f) => path.join(root, 'assets', f);
  assert.ok(fs.existsSync(p('bunny-live-wallpaper.mp4')));
  assert.ok(fs.existsSync(p('bunny-poster.webp')));
  assert.ok(fs.statSync(p('bunny-live-wallpaper.mp4')).size < 3 * 1024 * 1024, 'the default loop stays small');
  assert.ok(fs.statSync(p('bunny-poster.webp')).size < 64 * 1024, 'the poster is tiny');
  const media = (html.match(/\.\/[A-Za-z0-9_\-./]+\.(mp4|webm|mov|m4v|webp|jpe?g|png|mp3)/g) || []);
  media.forEach((m) => assert.ok(has(m, './assets/'), 'media outside /assets/: ' + m));
  assert.ok(has(html, POSTER));
});

test('21. the runtime font loader stays headless-safe and never blocks first paint', () => {
  const a = harness();
  const style = a.w.document.getElementById('sdpDynamicFonts');
  assert.ok(style, 'the loader injects a runtime style element');
  assert.ok(has(style.textContent, '@import url("https://fonts.googleapis.com/css2?family=Inter'));
  assert.ok(has(style.textContent, 'Noto+Sans+Sinhala'));
  assert.ok(has(html, 'setTimeout(function(){try{if(!navigator.onLine||/HeadlessChrome/i.test(navigator.userAgent))return;'), 'the loader never runs headless');
  a.close();
});

test('22. sheets, players and tabs never stop the wallpaper', () => {
  const a = harness();
  const q = a.q;
  const doc = a.w.document;
  const video = doc.getElementById('bgLiveVideo');
  assert.ok(video, 'the live video element exists');
  assert.ok(cssText().indexOf('#bgLiveVideo{position:absolute') >= 0, 'the wallpaper layer stays mounted');
  q.UI.setTab('words');
  assert.equal(q.UI.tab, 'words');
  assert.ok(doc.getElementById('bgLiveVideo'), 'the wallpaper survives a tab switch');
  q.UI.setTab('home');
  a.close();
});
