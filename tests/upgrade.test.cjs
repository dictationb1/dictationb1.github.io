'use strict';
/* v52 (APP_VERSION 5.8.0) release gate.
 *
 * Covers the ElevenLabs one-time studio voice vault, the admin one-click word
 * auto-completer, the v52 metadata/storage migration and the 13 deep audit
 * areas. Written from scratch; fixtures are produced with fs.writeFileSync.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const acorn = require('acorn');
const { harness, html } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms || 0));
const HOODED = './assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4';
const VOICE = 'Xb7hH8MSUJpSbSDYk0k2';

function appScript() {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, 'inline application script found');
  return match[1];
}

function fetchStub(state) {
  return function (url) {
    const target = String(url && url.url ? url.url : url);
    state.calls.push(target);
    if (/translate\.googleapis\.com/.test(target)) {
      state.english.push(decodeURIComponent(target.split('&q=')[1] || ''));
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([[['සිංහල අර්ථය']]]) });
    }
    if (/dictionaryapi\.dev/.test(target)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{
          word: 'zephyr',
          phonetic: '/ˈzef.ər/',
          phonetics: [{ text: '/ˈzef.ər/', audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/zephyr-uk.mp3' }],
          meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A soft gentle breeze.', example: 'A warm zephyr crossed the harbour.' }] }]
        }])
      });
    }
    if (/api\.elevenlabs\.io\/v1\/text-to-speech/.test(target)) {
      state.synth.push(target);
      return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]).buffer) });
    }
    if (/elevenlabs-audio\.json/.test(target)) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(state.shared || { version: 52, voiceId: VOICE, clips: {} }) });
    }
    if (/user\/subscription/.test(target)) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ tier: 'free', character_count: 250, character_limit: 10000 }) });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
  };
}

function withApp(options) {
  const state = { calls: [], english: [], synth: [], shared: null };
  const handle = harness(options && options.seed, {
    fetch: true,
    before: (w) => {
      w.fetch = fetchStub(state);
      if (options && options.before) options.before(w);
    }
  });
  return Object.assign(handle, { state });
}

test('v52 metadata: every published file advertises APP_VERSION 5.8.0 and schema 52', () => {
  for (const file of ['data/version.json', 'data/config.json', 'data/session.json']) {
    const data = json(file);
    assert.equal(data.ver, 52, file + ' ver');
    assert.equal(data.appVersion, '5.8.0', file + ' appVersion');
    if ('version' in data) assert.equal(data.version, '5.8.0', file + ' version');
    assert.equal(data.settingsRev, 52, file + ' settingsRev');
    assert.equal(data.activeVideoSrc, HOODED, file + ' activeVideoSrc');
    if (data.key) assert.equal(data.key, 'sdp.v52_elevenlabs_studio', file + ' key');
    if (data.storageKey) assert.equal(data.storageKey, 'sdp.v52_elevenlabs_studio', file + ' storageKey');
  }
  const vault = json('data/elevenlabs-audio.json');
  assert.equal(vault.version, 52);
  assert.equal(vault.voiceId, VOICE);
  assert.deepEqual(Object.keys(vault.clips), []);
});

test('index.html stays single file, ES5 and inside the byte budget', () => {
  assert.ok(!/<link\b/i.test(html), 'no static <link> tag');
  const script = appScript();
  acorn.parse(script, { ecmaVersion: 5 });
  assert.ok(!/\basync\b\s*function|=>|`/.test(script), 'no ES6 syntax in the app');
  assert.ok(Buffer.byteLength(html) < 456000, 'index.html under budget');
  assert.match(html, /APP_VERSION="5\.8\.0"/);
  assert.match(html, /sdp\.v52_elevenlabs_studio/);
});

test('the Hooded Red Eyes wallpaper is the default and all three repo videos are listed', () => {
  const app = withApp();
  const q = app.q;
  assert.equal(q.DEFAULT_WALLPAPER_SRC, HOODED);
  assert.equal(q.CONFIG.repoMedia.length, 3);
  const paths = q.CONFIG.repoMedia.map((item) => item.src);
  assert.ok(paths.indexOf(HOODED) > -1, 'hooded loop listed');
  assert.ok(paths.indexOf('./assets/bunny-live-wallpaper.mp4') > -1, 'bunny listed');
  assert.ok(paths.indexOf('./assets/wanderingpixels_2025-12-26_7588160805032430870.mp4') > -1, 'wandering pixels listed');
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/hooded-poster.webp')));
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/wanderingpixels-poster.webp')));
  const live = q.LiveWallpaper;
  const media = live.repoMediaList();
  assert.equal(media.length, 3);
  assert.equal(media[0].title, 'Hooded Red Eyes Live Wallpaper 1080p Loop');
  assert.equal(media[0].poster, './assets/hooded-poster.webp');
  app.close();
});

test('ElevenVault exposes the deterministic cache key, the three tiers and the credit-safe stats', () => {
  const app = withApp();
  const vault = app.w.ElevenVault;
  assert.equal(typeof vault, 'object');
  assert.deepEqual(Object.keys(vault.sharedMap), []);
  assert.deepEqual(Object.keys(vault.memMap), []);
  assert.deepEqual(Object.keys(vault.inflight), []);
  assert.equal(vault.stats.generatedCount, 0);
  assert.equal(vault.voiceId(), VOICE);
  assert.equal(vault.modelId(), 'eleven_flash_v2_5');
  assert.equal(vault.creditRate(), 0.5);
  assert.equal(typeof app.w.TTS.hashText, 'function');
  const a = vault.keyFor('Number 1'), b = vault.keyFor('  Number   1  ');
  assert.equal(a, b, 'normalised text maps to one key');
  assert.match(a, /^el_Xb7hH8MSUJpSbSDYk0k2_/);
  assert.notEqual(a, vault.keyFor('Number 2'));
  assert.equal(vault.keyFor('Three.').indexOf('el_' + VOICE + '_'), 0);
  app.close();
});

test('saving the admin API key keeps it in localStorage and never leaks into the page', () => {
  const app = withApp();
  const vault = app.w.ElevenVault;
  vault.setApiKey('sk_test_123');
  app.q.DB.saveNow();
  assert.equal(vault.apiKey(), 'sk_test_123');
  assert.equal(vault.hasKey(), true);
  const stored = app.w.localStorage.getItem('sdp.v52_elevenlabs_studio');
  assert.ok(stored && stored.indexOf('sk_test_123') > -1, 'key persisted');
  assert.equal(vault.keyFor('afraid').indexOf('sk_test_123'), -1);
  app.close();
});

test('a shared vault clip plays with zero API calls (tier 1)', () => {
  const app = withApp();
  const vault = app.w.ElevenVault;
  const spoken = [], played = [];
  app.q.Speech._playUrl = (url, text) => played.push({ url, text });
  const key = vault.keyFor('afraid');
  vault.sharedMap[key] = 'data:audio/mpeg;base64,AAAA';
  const handled = vault.speakText('afraid', 'en', app.q.Speech._seqToken, spoken.push.bind(spoken));
  assert.equal(handled, true);
  assert.equal(played.length, 1);
  assert.equal(played[0].url, 'data:audio/mpeg;base64,AAAA');
  assert.equal(app.state.synth.length, 0, 'no ElevenLabs request for a cached clip');
  assert.ok(vault.stats.sharedHits >= 1);
  app.close();
});

test('generating the same clip twice calls ElevenLabs exactly once (in-flight dedupe)', async () => {
  const app = withApp();
  const vault = app.w.ElevenVault;
  vault.setApiKey('sk_test_123');
  const results = [];
  vault.generate('Number 1', (err, url) => results.push([err, url]));
  vault.generate('Number 1', (err, url) => results.push([err, url]));
  await sleep(30);
  assert.equal(app.state.synth.length, 1, 'one network call for two concurrent requests');
  assert.equal(results.length, 2, 'both waiters resolved');
  assert.equal(results[0][0], null);
  assert.match(results[0][1], /^data:audio\/mpeg;base64,/);
  assert.equal(vault.stats.generatedCount, 1);
  assert.equal(vault.memMap[vault.keyFor('Number 1')], results[0][1], 'permanent in-memory clip');
  const again = [];
  vault.resolve('Number 1', (err, url) => again.push(url));
  await sleep(30);
  assert.equal(app.state.synth.length, 1, 'the second play costs 0 credits');
  assert.equal(again[0], results[0][1]);
  app.close();
});

test('without an API key the single British studio stream is used for every utterance', () => {
  const app = withApp();
  const played = [];
  app.q.Speech._playUrl = (url, text) => played.push({ url, text });
  const token = app.q.Speech._seqToken;
  assert.equal(app.w.ElevenVault.speakText('Number 1', 'en', token, () => {}), false, 'vault declines');
  app.q.Speech.playWord('afraid');
  assert.equal(played.length, 1);
  assert.match(played[0].url, /^https:\/\/dict\.youdao\.com\/dictvoice\?type=1&audio=afraid$/);
  assert.equal(app.w.ElevenVault.stats.generatedCount, 0);
  app.close();
});

test('AdminAutoEnrich parses raw words and fills IPA, definition, Sinhala meaning and sentence', async () => {
  const app = withApp();
  const enrich = app.w.AdminAutoEnrich;
  assert.deepEqual(enrich.parse('afraid, amazed\nannoyed; 3) anxious'), ['afraid', 'amazed', 'annoyed', 'anxious']);
  assert.deepEqual(enrich.parse('Afraid, afraid , afraid'), ['afraid']);
  const out = await new Promise((resolve) => {
    enrich.enrichAll('zephyr', () => {}, resolve);
  });
  assert.equal(out.length, 1);
  const word = out[0];
  assert.equal(word.w, 'zephyr');
  assert.equal(word.p, 'ˈzef.ər');
  assert.equal(word.d, 'A soft gentle breeze.');
  assert.equal(word.s, 'A warm zephyr crossed the harbour.');
  assert.equal(word.m, 'සිංහල අර්ථය');
  assert.equal(word.si, 'සිංහල අර්ථය');
  assert.ok(app.state.calls.some((url) => /api\.dictionaryapi\.dev\/api\/v2\/entries\/en\/zephyr/.test(url)));
  assert.ok(app.state.calls.some((url) => /translate\.googleapis\.com.*sl=en&tl=si/.test(url)));
  app.close();
});

test('built-in lexicon words are completed offline from the shipped dictionary', async () => {
  const app = withApp();
  app.w.fetch = (url) => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
  const word = await new Promise((resolve) => app.w.AdminAutoEnrich.enrich('afraid', resolve));
  assert.equal(word.w, 'afraid');
  assert.ok(word.p, 'IPA present');
  assert.ok(word.d.indexOf('Feeling fear') === 0, 'built-in definition kept: ' + word.d);
  assert.equal(word.s, 'She was never afraid of speaking in front of a large audience.');
  assert.equal(word.m, 'බියට පත් වූ', 'offline Sinhala fallback from the built-in dictionary');
  app.close();
});

test('one-click auto-complete publishes a new session, archives the previous one and saves every field', async () => {
  const app = withApp();
  const before = app.q.DB.data.lists.length;
  const previous = app.q.DB.data.session.listId;
  const result = await new Promise((resolve) => {
    app.w.AdminAutoEnrich.run('zephyr, afraid', { title: 'Session 9 - Weather', date: '2026-11-05', no: '9' }, () => {}, resolve);
  });
  assert.equal(result.ok, true);
  const data = app.q.DB.data;
  assert.equal(data.lists.length, before + 1);
  const list = data.lists[data.lists.length - 1];
  assert.equal(list.name, 'Session 9 - Weather');
  assert.equal(list.words.length, 2);
  assert.equal(list.published, true, 'published for students');
  list.words.forEach((word) => {
    assert.ok(word.w && word.p && word.d && word.m && word.s, 'complete word object: ' + JSON.stringify(word));
  });
  assert.equal(data.session.no, '9');
  assert.equal(data.session.listId, list.id);
  assert.equal(data.session.date, '2026-11-05');
  assert.equal(data.plan.pinned, list.id);
  assert.ok(data.pastSessions.some((session) => session.listId === previous), 'previous session archived');
  app.q.DB.saveNow();
  const saved = JSON.parse(app.w.localStorage.getItem('sdp.v52_elevenlabs_studio'));
  assert.equal(saved.session.listId, list.id);
  app.close();
});

test('v51/v50 stored data migrates to schema 52 without losing the learner', () => {
  const seed = {
    v: 51,
    settingsRev: 51,
    lists: [{ id: 'list_old', name: 'Old list', words: [{ w: 'afraid', s: 'x', m: 'y' }], version: 1, published: true }],
    settings: { theme: 'dark', mode: 'paper', perf: 'lite', activeVideoSrc: './assets/bunny-live-wallpaper.mp4', adminPin: '78987898' },
    plan: { weekdays: ['', '', '', '', '', '', ''], dates: {}, pinned: 'list_old', defaultList: 'list_old' },
    pastSessions: [],
    sessions: [],
    profile: { nickname: 'Nimal', deviceId: 'dev-1', badges: {}, streak: { count: 0, last: '' } }
  };
  const app = withApp({
    before: (w) => {
      w.localStorage.clear();
      w.localStorage.setItem('sdp.v52_elevenlabs_studio', JSON.stringify(seed));
    }
  });
  const data = app.q.DB.data;
  assert.equal(data.v, 52);
  assert.equal(data.settingsRev, 52);
  assert.equal(data.profile.nickname, 'Nimal');
  assert.equal(data.lists[0].id, 'list_old');
  assert.equal(data.settings.elevenLabsKey, '');
  assert.equal(data.settings.elevenLabsVoiceId, VOICE);
  assert.equal(data.settings.activeVideoSrc, HOODED);
  assert.ok(app.w.localStorage.getItem('sdp.v52_elevenlabs_studio'), 're-saved under the v52 key');
  app.close();
});

test('admin PIN 78987898 is the only key and every Studio control is wired', () => {
  const app = withApp();
  assert.equal(app.q.CONFIG.adminPin, '78987898');
  app.q.DB.data.settings.adminPin = '78987898';
  app.q.Admin.unlocked = true;
  const host = app.w.document.createElement('div');
  host.id = 'adminHost';
  app.w.document.body.appendChild(host);
  app.q.Admin.renderTab(host);
  const ids = ['elCreditBadge', 'elApiKeyInput', 'btnElToggleKey', 'btnElVerify', 'elVoiceSelect', 'elVoiceCustom', 'elModelSelect', 'elGenProgress', 'btnElGenerateAll', 'btnElGeneratePack', 'btnElExportJson', 'btnElImportJson', 'elVaultStats', 'adminQuickWordsInput', 'adminQuickSessionTitle', 'adminQuickSessionDate', 'btnAdminAutoComplete', 'adminQuickStatus'];
  ids.forEach((id) => assert.ok(host.querySelector('#' + id), 'control #' + id + ' rendered'));
  const voiceIds = Array.from(host.querySelectorAll('#elVoiceSelect option')).map((option) => option.value);
  assert.deepEqual(voiceIds.slice(0, 4), [VOICE, 'XB0fDUnXU5powFXDhCwa', 'pFZP5JQG7iQjIQuC4Bku', 'ThT5KcBeYPX3keUQqHPh']);
  const modelIds = Array.from(host.querySelectorAll('#elModelSelect option')).map((option) => option.value);
  assert.deepEqual(modelIds, ['eleven_flash_v2_5', 'eleven_multilingual_v2']);
  app.close();
});

test('the admin key field saves and verifies through the subscription endpoint', async () => {
  const app = withApp();
  const host = app.w.document.createElement('div');
  host.id = 'adminHost';
  app.w.document.body.appendChild(host);
  app.q.Admin.unlocked = true;
  app.q.Admin.renderTab(host);
  host.querySelector('#elApiKeyInput').value = 'sk_admin_key';
  host.querySelector('#btnElVerify').click();
  await sleep(40);
  assert.equal(app.w.ElevenVault.apiKey(), 'sk_admin_key');
  assert.ok(app.state.calls.some((url) => /api\.elevenlabs\.io\/v1\/user\/subscription/.test(url)));
  const badge = host.querySelector('#elCreditBadge').textContent;
  assert.match(badge, /✓ Connected · Tier: Free · Remaining Credits: 9,750 \/ 10,000 · Vault Clips Cached: 0/);
  app.close();
});

test('thirteen audit areas are wired in the shipped page', () => {
  const script = appScript();
  const app = withApp();
  assert.equal(app.q.DEFAULT_WALLPAPER_SRC, HOODED);
  assert.equal(app.q.CONFIG.repoMedia.length, 3);
  for (const name of ['preBuffer', 'preloadCoreAudio', 'preloadRollingWindow']) {
    assert.equal(typeof app.q.Speech[name], 'function', name + ' is real');
  }
  assert.match(script, /Number \"\+/);
  assert.equal(app.q.Speech.letterNames.z, 'zed');
  assert.equal(app.q.Speech.letterNames.h, 'aitch');
  assert.ok(app.w.document.getElementById('btnPause'), 'static #btnPause');
  assert.ok(app.w.document.getElementById('staticControlDepot'), 'static control depot');
  assert.match(html, /backdrop-filter:var\(--bd\)!important/);
  assert.match(html, /--bd:blur\(14px\)saturate\(1\.6\)brightness\(1\.03\)/);
  assert.ok(!/backdrop-filter:none!important;?}/.test(html.replace(/\s+/g, '')), 'no global backdrop-filter killer');
  assert.match(html, /body\.sheet-open #credit\{z-index:40!important;opacity:\.35!important\}/);
  assert.match(html, /@keyframes hansanaCinemaCycle/);
  assert.match(html, /#credit \.hansanaSpot/);
  assert.match(html, /#credit \.ring/);
  assert.match(script, /Incorrect PIN/);
  assert.match(html, /#bgLiveVideo\{object-position:center 28%;object-fit:cover!important\}/);
  app.close();
});
