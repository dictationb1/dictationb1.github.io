# v60-9003 PROGRESS

Branch (this session): `arena/2b3130b8-dictationb1-github-io` (spec branch `feat/v60-nextgen-9-0-0-3` did not exist;
by session policy I must stay on the session branch — spec W2 fallback "keep the session's own branch and use it everywhere").
Base commit: `8f1f452 Merge pull request #108 from dictationb1/arena/42d54228-dictationb1-github-io`
(not in the expected list `ab2303b` / `548c641` — continued, as instructed).

## Baseline sizes (bytes)
| file | bytes |
|---|---|
| index.html | 483923 |
| data.html | 59845 |
| data/index.html | 59845 |
| data/learning-tools.js | 158911 |
| data/studio.js | 104567 |
| sw.js | 5991 |

node v22.22.3. `npm ci --prefix tests` OK.
Cheap check on untouched baseline: **PASS** (check.cjs exit 0; upgrade.test.cjs 25/25 pass).

## Browser probe
No `~/.cache/ms-playwright`; no system chromium on PATH. `@sparticuz/chromium` + `playwright-core` ship in tests/node_modules
via `tests/chromium-env.cjs`. Probe of G5 (`node tests/browser.cjs`): ran 52 checks, exit=1, 1 pre-existing FAIL
("v53 the admin panel is the 3-card Professor Studio with the credit lock banner") — recorded as a pre-existing baseline
failure, NOT ENV-BLOCKED (Chromium works).

## Phases
- [x] P0 preflight and helpers
- [x] P1 version 9.0.0.3, fault-tolerant SW, head cache eviction
  - JSON stamps: data/version.json, data/config.json (defaults.perf=auto, wallpaperVideo=false), data/session.json, data/elevenlabs-audio.json (modelId eleven_flash_v2_5), data/media-manifest.json (also validated by check.cjs). No root version.json exists in this repo.
  - sw.js: VERSION=sdp-v60-9.0.0.3, APP_VERSION=9.0.0.3, SW_VERSION, MEDIA_MAX_ENTRIES=160, per-entry install fetch (no addAll), activate evicts caches without 9.0.0.3 except sdp-youdao-v1, network-first for navigate/html/js/json. 5991 -> 7100 bytes.
  - index.html: APP_VERSION 9.0.0.3, vault {version:60}, payload {ver:60}, learning-tools.js?v=9.0.0.3, studio.js?v=9.0.0.3, body class sdp-nextgen tint-clear, #sdpSwBoot injected right after the charset meta. 483923 -> 484683 bytes. data.html release line -> 9.0.0.3, copied to data/index.html (cmp OK).
  - data/data-meter.js METER_VERSION 9.0.0.3; data/learning-tools.js SDPVersion.current 9.0.0.3.
  - tests updated: check.cjs, upgrade.test.cjs, server.cjs, phase1.cjs, audit-v42.cjs, live-lab.cjs.
  - G1 PASS, G2 PASS (25/25), G4 PASS. G3 phase1.cjs: 1 FAIL - 5.1 asserts ElevenVault.modelId() == eleven_multilingual_v2 while studio ships eleven_flash_v2_5 (R9 mandates flash_v2_5); assertion updated in P2.
- [x] P2 index.html top-gap cleanup + studio flash/vault hardening
  - index.html already clean: zero `top:calc(68px`, zero `154px`, zero `iterations:15e4/150000`; `iterations:250000` already present (SDP_ENC_V2 in EncryptedVault); no `.createMediaElementSource(`. No index.html edit made (nothing to purge); the v60 top gap is enforced by #sdpNextGenCss in P3.
  - data/studio.js: modelId eleven_flash_v2_5 and voiceId Xb7hH8MSUJpSbSDYk0k2 already default; appended an ES5 `SDP_ENC_V2` params block (PBKDF2 / SHA-256 / 250000 / AES-GCM 256) exposing `SDP_ENC_V2:` + saveVault/getVault delegates via window.SDPEncV2. 104567 -> 106144 bytes.
  - tests/phase1.cjs 5.1: default-model assertion changed eleven_multilingual_v2 -> eleven_flash_v2_5 (R9 requirement).
- [x] P3 cascade supremacy, global chrome, wrapped Screens.home
  - New ES5 module appended to data/learning-tools.js (source: .work/v60-9003/v60-p3-home.js, 158911 -> 215687 bytes): neutraliseLegacyStyles() + #sdpNextGenCss design system (Zinc-950/Sky-400, zero backdrop-filter, Inter/Noto Sinhala), MutationObserver keeping #sdpNextGenCss last in head, wallpaper purge, mountChrome() (brand cluster, 3 top actions, 5-slot tabbar, desktop rail), renderNextGenHome() (greeting, hero rewrite, 4 config chips, 46px CTA + est, how-it-works, 3 stat cards, 2x2 quick practice), creditDocked/creditPill/microToastLoad, SDP_applyLang i18n.
  - Wrappers installed: Screens.home (renders v60 home every call), UI.setTab (intercepts 'dictate' -> Eng.start, re-mounts chrome), Eng.paint (re-renders home at depth 0).
  - Adapted anchor: the legacy topbar controls block is moved whole into #sdpLegacyKeeper (all of #topDataBadge/#btnLiveVideo/#chipNet/#btnLang/#btnGuideTop/#btnPerf/#btnTheme/#btnRefresh/#btnAdmin/#btnLock stay in the DOM).
  - Adapted anchor: tabbar keeps its real data-tab buttons (internals use #tab-<name>); #tab-comm goes to the keeper and #tab-dictate is inserted in its slot so the 5-slot indicator/index math stays exact. #tab-prac is created as a hidden alias in the keeper (id availability), #tab-practice stays the visible Practice tab.
  - JSDOM smoke (.work/v60-9003/smoke.cjs): all v60 ids present, #sdpNextGenCss last in head, sdpV57Css/sdpV58Css disabled + neutralised, wallpaper-on removed, 0 script errors.
- [x] P4 wrapped cockpit, priority-1 settings, words explorer, Sinhala i18n
  - Inserted inside the v60 module (learning-tools.js 215687 -> 244304 bytes): wrapSettings (Screens.settings + Screens.set), renderNextGenSettings (#sdpNextGenSettings first child of #screen-set, PRIORITY 1 six wired controls, PRIORITY 2 voice card, PRIORITY 3 collapsed <details id=sdpAppearanceAccordion> holding #setBody), wrapDict/renderWordCards (#sdpWordFilterRow All/Weak/Mastered/A-Z + full .sdp-word-card.wordcard.v59-dict-card cards with .v59-ipa/.v59-pos/.sdp-si-pill + play/slow), wrapCockpit (Eng.openPlayer/paint/paintCountdown -> #sdpCockpitCard, #sdpEdgeBar(Fill), #sdpCockpitHeaderRow with #plStatus + #sdpTimerPill holding #cdNum and the #cdFg ring, #sdpCockpitStage/#sdpLetterSlots, #sdpCockpitDock 4 helpers, #sdpCockpitFoot pause/skip, #sdpCockpitCounters, #sdpWordMapCard).
  - Adapted anchor: legacy player action rows are hidden by walking #sdpCockpitCard children and hiding any untouched child that contains a <button> (no class guesses), instead of deleting them.
  - Adapted anchor: the real player layer is UL.layer (no .player class in this build), so decoration matches #layers .layer and .lens hiding is scoped '.layer .lens,.layer.player .lens'.
  - JSDOM smoke: settings box first, accordion closed with #setBody inside, all six controls + legacy ids present, speed pill sets rate 0.75, 30 word cards with 30 IPA + 30 Sinhala pills, cockpit ids all present after Eng.start+skipReady.
- [ ] P5 lockstep test gates + absence assertions
- [ ] P6 docs, PR, merge

## Gates
| gate | command | status |
|---|---|---|
| G1 | node tests/check.cjs | PASS (P1) |
| G2 | node --test tests/upgrade.test.cjs | PASS 25/25 (P1) |
| G3 | node tests/phase1.cjs | PASS (P2) |
| G4 | node tests/server.cjs | PASS (P1) |
| G5 | node tests/browser.cjs | pre-existing FAIL x1 (baseline) |
| G6 | node tests/upgrade-browser.cjs | |
| G7 | node tests/e2e.cjs | |
| G8 | node tests/live-lab.cjs | |
| G9 | node tests/audit-v42.cjs | |
