# ARCHITECTURE_MAP — Smart Dictation Player v0.0.1.e

Audience: **CCBE Galle Branch — B1 English Class, Sri Lanka**
Lecturer in Charge: **Ms. Sumodya Sewmini** · Creator: **Hansana** · Concept: **Ayya01 (Lesandu)**

This file is the map of every shipped byte. Read it before touching anything; if
a change needs a new file, it needs a new row in §H1 and a new budget in
`tests/check.cjs` (gate G1), or the release fails.

---

## 1. File tree (H1 — every file, one owner, one byte ceiling)

| File | Budget | Owner / role |
| --- | --- | --- |
| `index.html` | ≤ 35,000 B | Shell: 54px header, 5 screens, guide modal, toast, boot check, 6 deferred modules |
| `assets/css/sdp-ui.css` | ≤ 60,000 B | The single stylesheet (Zinc + Sky flat matte). No runtime CSS injection, ever |
| `assets/fonts/NotoSansSinhala-Regular.woff2` | exactly 48,520 B | **Preserved read-only**, SHA-256 locked |
| `assets/fonts/NotoSansSinhala-Bold.woff2` | exactly 48,748 B | **Preserved read-only**, SHA-256 locked |
| `data/sdp-data-sync.js` | ≤ 65,000 B | `SDP.Data` (5 keys), `SDP.Sync` (fetch/reconcile/publish/SW), `SDP.Sync.Vault` (`SDP_ENC_V2`) |
| `data/sdp-audio-speech.js` | ≤ 48,000 B | `SDP.Speech`: `say()` normaliser, 4-tier `playWord()`, shared `<audio>` |
| `data/sdp-dictation-engine.js` | ≤ 58,000 B | `SDP.Engine`: beat machine, ring/bar timer, Paper/Typing, hints, 30-row self-check |
| `data/sdp-ui-views.js` | ≤ 110,000 B | `SDP.Views`: `STRINGS_EN`/`STRINGS_SI`, router, Home, Guide, Words, Practice, Settings, toast |
| `data/studio.js` | ≤ 85,000 B | `SDP.Studio`: PIN vault, session editor, recorder, ElevenLabs, publish |
| `data/data-meter.js` | ≤ 22,000 B | Preserved metering engine, `METER_VERSION = '0.0.1.a'`, `SCHEMA = 1` |
| `data/session.json` | exactly 46,403 B | **Preserved read-only**: 30 Session 8 words + 30 archived Session 7 words + plan |
| `data/config.json` | ≤ 36,000 B | Preserved backend payload; only `ver/appVersion/version/schema/settingsRev` are ours |
| `data/version.json` | ≤ 2,000 B | Slim pointer schema (H3) |
| `data/gas-source.txt` | exactly 13,764 B | **Preserved read-only**: Apps Script backend |
| `data/elevenlabs-audio.json` | ≤ 2,500,000 B | **App-written** Alice voice pack (D-UI11); header asserted, clips travel with the repo |
| `data.html` | ≤ 60,000 B | `/data` transparency route |
| `data/index.html` | ≤ 60,000 B | Byte-identical twin of `data.html` |
| `sw.js` | ≤ 12,000 B | `sdp-v0.0.1.e` service worker |
| `manifest.webmanifest` | ≤ 4,000 B | PWA manifest, description pinned to `0.0.1.e` |
| `docs/*.md` (5 files) | ≤ 40,000 B each (template ≤ 18,000 B) | This ledger |

**Preserved files are never edited by hand.** `tests/check.cjs` compares their
byte count *and* SHA-256; the hashes live in its `PRESERVED_SHA` table and in
`docs/SYNC_AND_DATA_CONTRACT.md` Appendix A. Since v0.0.1.d that table is four
files, not five: `data/elevenlabs-audio.json` is written by the Lecturer Studio
on every publish (D-UI11), so freezing it would have made publishing impossible.

---

## 2. Public namespace (R10)

```js
window.SDP = {
  version: '0.0.1.b', build: '2026-11-01', ver: 2,
  Data:   { /* storage + migration */ },
  Sync:   { /* fetchers, reconciliation, publishing, Service Worker, Vault */ },
  Speech: { /* utterances + audio tiers */ },
  Engine: { /* beat machine + grading */ },
  Views:  { /* i18n + renderers + router */ },
  Studio: { /* lecturer tools */ }
};
window.SDPCore = window.SDP;   // alias kept for the test harness
window.SDPDataMeter = { ... }; // preserved metering engine (data-meter.js)
```

Load order is fixed and enforced by G1:

1. `data/data-meter.js`
2. `data/sdp-data-sync.js`
3. `data/sdp-audio-speech.js`
4. `data/sdp-dictation-engine.js`
5. `data/sdp-ui-views.js`
6. `data/studio.js`

`index.html` runs one inline boot script **before** those six: it compares
`window.__SDP_BOOT_VERSION__` with `data/version.json` and, when a newer build is
published, purges stale `sdp-*` caches (never `sdp-youdao-v1` / `sdp-audio-clips`)
and reloads exactly once (`sessionStorage['sdp_upgraded_to']` guard). The watcher
re-checks on `visibilitychange` so a board or phone left open across the school
day still reloads to 0.0.1.b within two minutes, exactly once.

---

## 3. Structural DOM contract (H2)

Any id below is a public interface: tests, CSS and the engine depend on it.

- **Shell:** `#appHeader`, `#sdpBrand`, `#brandName`, `#sdpVerPill`, `#btnGuideTop`, `#btnLang`, `#btnTheme`, `#sdpScreens`, `#tabbar`, `#sdpSideRail`
- **Tabs:** `#tab-home`, `#tab-player`, `#tab-practice`, `#tab-dict`, `#tab-settings` (rail twins: `#rail-*`)
- **Screens:** `#screen-home`, `#screen-player`, `#screen-practice`, `#screen-dict`, `#screen-settings`
- **Home:** `#homeHero`, `#homeTitle`, `#homeSub`, `#btnStart`, `#btnGuide`, `#homeStatsRow`, `#homeQuickPractice`, `#homeAnn`, `#creditFoot`
- **Cockpit:** `#cockpitBar`, `#sessionTitle`, `#wordPosBadge`, `#cockpitProgress`, `#beatRing`, `#beatBar`, `#beatSeconds`, `#beatStage`, `#beatStateText`, `#hintChips`, `#typeInput` (**typing mode only**), `#btnPrev`, `#btnPlayPause`, `#btnNext`, `#btnRepeat`, `#btnHint`, `#btnModeSwitch`, `#btnFinish`
- **Results:** `#resultsPanel`, `#resultsTable`, `#scoreValue`, `#scorePct`, `#btnMarkAll`, `#btnToggleMissed`, `#btnRetryMissed`, `#btnNewSession`
- **Guide:** `#guideModal`, `#guideSteps`, `#guideLangPill`, `#guideSpeak`, `#btnGuideClose`
- **Words:** `#dictSearch`, `#dictFilterRow`, `#dictList`
- **Practice:** `#pracMode`, `#pracStage`, `#pracWeakOnly`
- **Settings:** `#settingsSections`, `#studioAccordion`, `#studioBody`
- **Toast:** `#sdpDataToast`

### Retired ids and strings (must never reappear)

`bgLiveWrap`, `bgLiveVideo`, `btnLiveVideo`, `liveVideoInput`, `dimTpl`,
`dimHostSet`, `sVideoDim`, `topDataBadge`, `topDataMB`, `topDataLkr`,
`btnDataSheet`, `dataSheet`, `guideSheet`, `btnReadyTest`, `screen-comm`,
`tab-comm`, `commBadge`, `btnMsg`, `printview`, `v58Rail`, `sdpDesktopRail`,
`sdpV56`, `materialMixer`, `I'm ready`, `Write the word now`.

G1 scans every shipped HTML/CSS/JS byte for these; G5 scans the live DOM. A
retired feature is deleted, never hidden with `display:none`.

---

## 4. Screens and the single-active-screen law (R3)

```css
.screen { display: none !important; }
.screen.active { display: block !important; }
```

`SDP.Views.showTab(name)` is the only function allowed to add/remove `.active`.
It also sets `aria-selected` on the five bottom tabs and the five rail buttons.

| Tab | Screen | Rendered by |
| --- | --- | --- |
| `home` | `#screen-home` | `Views.renderHome()` |
| `player` | `#screen-player` | `Views.startDictation()` → `Engine.start()` |
| `practice` | `#screen-practice` | `Views.renderPractice()` |
| `dict` | `#screen-dict` | `Views.renderWords()` (30 cards immediately) |
| `settings` | `#screen-settings` | `Views.renderSettings()` |

Responsive navigation: `< 1024px` → bottom `#tabbar` (60px); `>= 1024px` →
232px `#sdpSideRail`. Both are in the DOM at all times; CSS decides which one is
visible, so no JS re-layout is needed.

---

## 5. Event flow

```
DOMContentLoaded (defer order guarantees all 6 modules are loaded)
        │
        ├─ Views.init()
        │    ├─ applyTheme(settings.theme) / applyLang(settings.lang)
        │    ├─ bindShell()  + Engine.bind()
        │    ├─ renderHome / renderWords / renderPractice / renderSettings
        │    ├─ first visit?  → openGuide()      (sdp.guide_seen !== '1')
        │    ├─ showToast()                      (2,400 ms whisper)
        │    └─ Sync.registerSW()
        │
        ├─ Sync.boot()  → fetch version/config/session (cache: no-store, 6 s cap)
        │    └─ applyPayloads() → 30 normalized words → emit 'sdp:ready'
        │         └─ Views.onDataReady() → Speech.loadManifest() → Studio.onDataReady()
        │
        └─ Engine.start() → per word: listening (repeats × gap) → writing (writeSecs)
              └─ finish() → grade() → renderResults() → Data.recordResult() → clearSession()
```

Custom events on `document`: `sdp:ready`, `sdp:update`, `sdp:settings`,
`sdp:progress`, `sdp:online`, `sdp:offline`.

---

## 6. The beat state machine (R5)

States: `idle → listening → writing → (next word | finished)`; `paused` can be
entered from either live phase and returns to the phase it left. Resume into
`writing` remounts `#typeInput` preserving typed text; resume into `listening`
bumps the epoch and restarts at repeat 1 with a fresh listening deadline.

- `listening` lasts `max(1200, (1500 + pauseSecs×1000) × repeats)` ms and speaks
  the word `repeats` times.
- `writing` lasts `writeSecs` ms (3–20 s).
- Ring: `stroke-dashoffset = C × (1 − fraction)` with `C = 2π × 34 ≈ 213.63`.
- Ring colour: `#38BDF8` listening · `#10B981` writing · `#F59E0B` when ≤ 3 s
  remain · `#A1A1AA` idle/paused.
- One 100 ms ticker drives ring, bar, `#beatSeconds` and `#beatStateText`;
  phase changes are deadline based, so the timer never drifts.

### Focus and input law (R4)

- **Typing mode** injects `#typeInput` into `#beatStage` and focuses it once per
  word with `focus({ preventScroll: true })`. It is the only `.focus()` call in
  the app.
- **Paper mode** never creates `#typeInput` and never focuses anything, so the
  on-screen keyboard can never yank the page mid-dictation.

---

## 7. Results and grading

| Mode | Grading | Persisted |
| --- | --- | --- |
| Paper | Student self-checks: every row starts `✅ Correct`; tapping `❌ Missed` flips it | `sdp.progress` via `Data.recordResult()` then `syncMastery()` |
| Typing | Case-insensitive, whitespace-normalised match against `word.w`; the typed string is shown with `.r-diff` | same |

`#scoreValue` always reads `"<correct> / <total>"`; `#scorePct` reads the
percentage. Finishing clears `sdp.session` and unlocks `#btnRetryMissed`
(a session over just the missed words) and `#btnNewSession` (all 30 again).

---

## 8. Audio priority chain (R5)

`SDP.Speech.playWord(word, opts, cb)` tries, in order:

1. Lecturer MP3 — `word.clipUrl`, or `SDP.Sync.getClipUrl()` →
   `assets/audio/session-w<idx>-<ts>.mp3` declared in the session clip map.
2. ElevenLabs cached clip — `data/elevenlabs-audio.json` `clips[word]` (Alice,
   `eleven_flash_v2_5`). Playback of a cached clip costs 0 credits.
3. Dictionary UK audio — `word.audio` (`dict.youdao.com/dictvoice?type=1`).
4. Browser `speechSynthesis`, `en-GB` voice preferred.

Tiers 1–3 always play through one shared plain `<audio id="sdpSharedAudio">`
element. Element audio is never routed through Web Audio, because that is what
silences cross-origin dictionary MP3s. `SDP.Speech.resolveTiers(word)` exposes
the computed chain so G9 can audit it without touching the network.

`SDP.Speech.say()` normalises its argument first
(`Array.isArray(input) ? input.slice() : [String(input)]`), so a sentence is
one utterance, never 56 character utterances.

---

## 9. Service worker (R6)

`sw.js` — `SW_VERSION = 'sdp-v0.0.1.b'`, `SHELL_CACHE = 'sdp-v0.0.1.b-shell'`,
`PRESERVE_CACHES = ['sdp-youdao-v1', 'sdp-audio-clips']`.

- **install** precaches the 18-file shell list and `skipWaiting()`.
- **activate** deletes every cache starting with `sdp-` that is not the shell
  cache or a preserved cache, then `clients.claim()`.
- **fetch**: dictionary audio → cache-first `sdp-youdao-v1`; lecturer/Alice clips
  → cache-first `sdp-audio-clips`; fonts/icons → cache-first shell; navigations
  and `.html/.json/.js/.css` → network-first with a 4,000 ms fallback to cache.

Because the shell is network-first, a published session shows up on the next
open; because audio is cache-first, replaying a word costs zero data.

---

## 10. Where to change what

| I want to… | Edit | Then |
| --- | --- | --- |
| change a colour, radius, spacing | `assets/css/sdp-ui.css` | `node tests/check.cjs` |
| add a UI string | `STRINGS_EN` **and** `STRINGS_SI` in `data/sdp-ui-views.js` | G3 language purity |
| add a screen element | `index.html` (+ H2 table here) | G1 tree tests |
| change pacing or grading | `data/sdp-dictation-engine.js` | G3 + G7 |
| change storage or sync | `data/sdp-data-sync.js` (+ `docs/SYNC_AND_DATA_CONTRACT.md`) | G2 |
| change audio order | `data/sdp-audio-speech.js` | G9 |
| publish a new session | Lecturer Studio (`data/studio.js`) | `docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md` |

---

## 12. Release gate map (v0.0.1.d)

| Gate | File | Runner | What it proves |
| --- | --- | --- | --- |
| G1 | `tests/check.cjs` | node | static contracts: ids, strings, budgets, load order |
| G2 | `tests/upgrade.test.cjs` | node:test | `Sync`/`Vault`/`Speech` API against real payloads |
| G3 | `tests/phase1.cjs` | jsdom | storage corruption, PIN lockout, guide, paper/typing runs |
| G4 | `tests/server.cjs` | node | config/metadata + Apps Script loader |
| G5 | `tests/browser.cjs` | Chromium | 54px header, one screen, focus law, ring colours, toast |
| G6 | `tests/upgrade-browser.cjs` | Chromium | v60 cache → 0.0.1.d, single reload, offline shell |
| G7 | `tests/e2e.cjs` | Chromium | the full student journey + backup download |
| G8 | `tests/live-lab.cjs` | Chromium | dead API, offline reload, hung relay, empty bank |
| G9 | `tests/audit-v42.cjs` | node | retirement, H1 budgets, ES5, PWA pins, preserved hashes |
| G10 | `tests/voice-guide.cjs` | jsdom | `pickVoice` exists, one en-GB professor, male names −100, Guide 2.0 step machine + tap banner |
| G11 | `tests/vault-sync.cjs` | jsdom | `SDP_ENC_V2` round trip, sequential publish with `version.json` last, fresh SHA per PUT, no PIN in any body |
| G12 | `tests/studio-safety.cjs` | jsdom | twelve-key `#pinPad`, zero-character quota read, 972-char cost preview, delta-only clips, no gate touches the billing endpoint |

The suite is exactly these twelve gates; G1 asserts that every one of them is
present, and G12 asserts that no gate or test file even mentions
`/v1/text-to-speech` (W5 credit safety).

Shared plumbing: `tests/static-server.cjs` (one server, `setOverride` for
per-test payloads) and `tests/app-harness.cjs` (jsdom + `@sinonjs/fake-timers`
+ WebCrypto + a fetch stub over the real `data/*.json`). Neither gate may
reimplement them; that is how the suite stays consistent.

## 13. Empty-bank behaviour (new in 0.0.1.a)

`SDP.Sync.wordCount() === 0` is a first-class state, not an error: Home shows
`#bankEmpty`, `#btnStart` is `disabled`, `#statMastered` renders `—`,
`startDictation()` toasts and stays on Home, and the Words tab hides the list
behind `#dictEmpty`. This is what a student sees if they install the PWA while
GitHub is unreachable and no cached payload exists.

---

**Credits — preserved verbatim, EN and SI.**
`CREDITS GOES TO Hansana` ·
Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu) ·
නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini

---

## 13. v0.0.1.d — classroom sync, PIN gate and the professor voice

Audience: **CCBE Galle Branch — B1 English Class, Sri Lanka**
Lecturer in Charge: **Ms. Sumodya Sewmini** · Creator: **Hansana** · Concept: **Ayya01 (Lesandu)**

| Pill | Line |
| --- | --- |
| `CREDITS GOES TO Hansana` | `Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)` |
| `නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini` | both lines ship in EN and SI on Home, About and `/data` |

### 13.1 New public surface (R10 additions)

```js
SDP.version = '0.0.1.d'; SDP.ver = 4;
SDP.Sync.adoptRemoteSettings(remoteConfig, remoteSettingsRev); // R1
SDP.Sync.fetchRawMainJson(relPath, cb);   // raw.githubusercontent.com, no token
SDP.Sync.pollVersionTick(cb);             // the 30 s pointer read
SDP.Sync.Vault.computePinVerifier(pin, saltB64);      // PBKDF2-SHA256, 250k
SDP.Sync.Vault.verifyPinVerifier(pin, verifierObj);   // constant-time compare
SDP.Sync.Vault.recordFail() / .strikes() / .resetLock();
SDP.Studio.saveClassSettings(cb);         // the #lecturerSyncBar button
SDP.Studio.classSettingKeys;              // the ten classroom keys
SDP.Speech.activeUtter();                 // VOX-01 module-scope guard
SDP.Speech.lastTierName();                // VOX-08 honest toast
SDP.Views.renderAll();                    // one repaint after an adoption
SDP.Views.openGuideQuick(mode); SDP.Views.finishQuickGuide(start);
```

### 13.2 New structural DOM ids (H2 additions)

`#lecturerSyncBar`, `#btnSyncClassSettings`, `#lecturerSyncLast`,
`#btnGuideSkipStart`, `#newPinInput`, `#confirmPinInput`, `#studioGasUrl`
(unlocked only). `#studioFirstTimePanel`, `#setupPin` and `#btnStudioSetup`
no longer exist anywhere in the locked Studio DOM (SEC-01).

### 13.3 Byte ceilings after the bump

Every H1 budget is unchanged; the largest growth is `data/sdp-ui-views.js`
(string tables + quick guide) and `data/studio.js` (class-settings publish),
both far inside their 110,000 B / 85,000 B ceilings. `data/config.json` gained
`classSettings` and `pinVerifier` and stays under 36,000 B.

## 14. v0.0.1.e — honest sync, British English default, guaranteed voice, Bento home

Audience and attribution are unchanged. New public surface (R10 additions):

```js
SDP.ver = 5; SDP.version = '0.0.1.e';
SDP.Sync.parseRemoteAppVer(v);        // one shared reader of string/object version fields
SDP.Sync.fetchRawMainJson(rel, cb);   // raw.githubusercontent.com source of the never-red check
SDP.Speech.hasStarted();              // real utter.onstart flag (D10/D11 watchdogs)
SDP.Speech.isAudioPlaying();          // shared <audio> playing flag
SDP.Speech.getVoicesSafe();           // voices after a user gesture, never throws
SDP.Speech.youdaoAudioUrl(text); SDP.Speech.shortGuideLine(i);
SDP.Studio.publishChecklist(payloads); // pre-publish coherence, plain-language problems
SDP.Studio.nextSyncRev();             // Math.max(Date.now(), prevSyncRev + 1) — the ONE publish clock
```

New structural classes (H2 additions): `.step-badge` (28 px circular journey numbers),
`.practice-grid` / `.practice-card` / `.prac-ico` / `.prac-title` / `.prac-sub`
(Quick Practice rich cards). `#screen-home` becomes a two-column Bento grid at
≥ 1024 px (`minmax(0,7fr) minmax(0,5fr)`, gap 16 px; `#creditFoot` spans the full
row). Behavioural contracts live in `docs/SYNC_AND_DATA_CONTRACT.md` §R13 and
`docs/UI_COMPONENT_GUIDE.md` §v0.0.1.e.
