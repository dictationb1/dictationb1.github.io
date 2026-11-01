# TASK — dictationb1/dictationb1.github.io: Single-Pass v61 Rebuild ("One App, One UI, Zero Layers" — v61 / 9.0.1.0)
Work autonomously through phases P0..P6 on branch `arena/v61-single-ui`; each phase ends with verify + commit + push so a new session can resume from the repo alone.
Ask no questions mid-run: choose the safest deterministic option that preserves all student/lecturer features (R4, R6) and report it in P6.
STOP only on the listed STOP conditions in P0 (wrong repository or corrupt baseline) or P6 (after PR creation if any gate is ENV-BLOCKED or FAIL).

> **DISEASE STATEMENT (read first, never forget it).** Between v57 (PR #105) and v60 (PR #110), five UI systems were stacked on top of each other instead of replacing the old one: (1) the static v57 HTML/CSS + 396 KB inline app inside `index.html` (485,175 B), (2) the v58 IIFE + `#sdpLearnCss` + `#sdpV57Css`/`#sdpV58Css` injectors, (3) the v59 IIFE + `#sdpV59Css` + `CRUSH_MQ` rule, (4) the v60 "Hurubuhuti" wrapper layer + `#sdpNextGenCss`, and (5) the v604 "janitor" layer of PR #110 (`#sdpPrePaintCloak` + `v604All()` re-sweeping the DOM at 900/2000/4000/5500/7000 ms, growing `data/learning-tools.js` to 269,514 B). Because `tests/check.cjs` and `tests/browser.cjs` required v57/v58/v59 substring markers to exist, previous agents could only append wrappers. The result: an 8-second multi-stage boot flash (FOUC), a blank Words tab (`#screen-dict`), a split-screen dictation player that violently auto-scrolls to `.ctrlgrid` when `#ansInput` focuses at +80 ms, a `[Test voice]` button that spells `"T-H-I-S-I-S-A-L-I-C-E"` character-by-character and crashes, a `position:fixed` swan credit pill covering interactive buttons on every screen, topbar bleed-through with garbled overlapping brand text (`"Jad"`, `"3pe"`, `"ngert"`), leaked v58 remnants on Home/Settings (`"Session progress 0/30"`, `"Paste blocked?..."`, duplicate `#repeatsSelect`, v58 footer), and six fake 11-byte Sinhala guide MP3 stubs.
> **THE CURE:** Do NOT add layer #6. Delete layers 1–5 and ship **ONE app, ONE UI system, ONE static stylesheet (`#sdpCss`), ONE extracted engine (`data/app-core.js`), ONE learning module (`data/learning-tools.js`), ONE speech pipeline, ONE single-screen dictation cockpit, ONE 3-group settings screen, and ONE static footer credit badge.**

## 0. WORKING RULES (W1..W10)

W1 SAVE THE SPEC. First action (skip if `.work/v61/SPEC.md` exists): with your file-write tool (not `echo`), save this entire message, unabridged, as `.work/v61/SPEC.md`. It holds (a) this spec, (b) the anchor inventory from P0 (`.work/v61/anchors.md`), (c) the phase checklist and decision log (`.work/v61/PROGRESS.md`). Re-read `.work/v61/SPEC.md` whenever context is compacted.

W2 RESUME. `git fetch origin --prune; git branch -r`. If `origin/arena/v61-single-ui` exists: check it out and read `.work/v61/PROGRESS.md`; continue at the first unfinished phase. If the branch exists but `.work/v61/PROGRESS.md` was already removed in P6, jump to P6 step 4 (PR/merge). If the branch does not exist: `git checkout -b arena/v61-single-ui origin/main`. (If pushing `arena/v61-single-ui` is rejected by platform branch rules, keep the session's assigned branch name and use it everywhere.)

W3 PROTECT YOUR CONTEXT. Huge or minified files at baseline: `index.html` (485,175 B, 65 lines, longest line 307,672 B), `data/learning-tools.js` (269,514 B, 5,012 lines), `data/studio.js` (106,144 B), `data.html` (59,845 B), `data/index.html` (59,845 B), and after P2 `data/app-core.js` (~350–410 KB). NEVER `cat`, `view`, `head`, `tail`, `sed -n`, plain `grep` without `-c`, `git diff`, or `git show` on them. Use ONLY `wc -c`, `grep -c`, `git diff --stat`, and `node .work/v61/peek.cjs <file> "<needle>" [before] [after] [nth]`. Send test output to `/tmp/*.log` and inspect only `tail -n 40` or `grep -n -i -E "fail|error|assert"`. Batch independent shell commands into ONE tool call.

W4 SAFE EDITING OF HUGE FILES. Edit huge/minified files ONLY through Node scripts built on `.work/v61/patchlib.cjs` (`rep`, `killRange`) or deterministic Node extractor/generator scripts written via your file-write tool or a QUOTED heredoc (`cat > f <<'EOF'`). Forbidden on huge files: `sed`, `perl -pi`, `awk` redirects, `node -e` one-liners. Write non-ASCII characters (Sinhala, emojis, IPA) inside JS generator scripts as `\uXXXX` escapes (or via `.work/v61/strgen.cjs`).

W5 ANCHORS & EVIDENCE OVER MEMORY. Every anchor in this prompt lists the occurrence count verified on `ef6cdfa` (v9.0.0.3) and `3066550` (v9.0.0.4). Always re-verify with `grep -c` or `peek.cjs` in P0 before patching; if a count differs between `ef6cdfa` and `3066550`, adapt once to the measured anchor in `.work/v61/anchors.md`.

W6 GATE DISCIPLINE & SAFETY NET. Per-phase cheap check (from P2 onward; in P1 the rewritten gates intentionally fail until P2/P3/P4 land):
`timeout 120 node tests/check.cjs > /tmp/check.log 2>&1 && timeout 300 node --test tests/upgrade.test.cjs > /tmp/upgrade.log 2>&1; echo "exit=$?"`
After every phase: verify its phase checks -> `git add -A && git commit -m "v61 P<N>: <summary>" && git push -u origin HEAD` -> update `.work/v61/PROGRESS.md`.

W7 NO ENDLESS LOOPS. Max 3 fix attempts per failing check. A browser gate failing solely for environment reasons (no Chromium binary, blocked external network, port in use) is `ENV-BLOCKED`: retry once, log in `PROGRESS.md`, and do NOT weaken product architecture to appease it. Never delete a behavioral or security test.

W8 SINGLE-UI INVARIANT. From P3 onward, the Single-UI grep invariant (R6) MUST return `0` across all shipped files at every commit. If any R6 grep returns `> 0`, the phase is NOT complete regardless of test results.

W9 HONEST DATA & NO FAKE ASSETS. The six 11-byte placeholder files `assets/audio/guide-si-1.mp3` .. `guide-si-6.mp3` MUST be deleted from the repo and removed from `sw.js` `SHELL`. Never ship a silent stub MP3 and never wire Sinhala narration to the broken Youdao `le=si` endpoint. Guide audio plays committed `si-LK` clips from `data/elevenlabs-audio.json` (or genuine local `si-LK` / `en-GB` synthesis) and when no Sinhala clip/voice exists on the device, displays an honest `"Sinhala voice not recorded yet — read step below"` badge.

W10 ONE PR & SHIP-OR-REVERT RULE. Create at most ONE pull request in P6 (reuse an existing open PR for the branch if one exists). Use platform PR tools or REST (`gh api repos/dictationb1/dictationb1.github.io/pulls ...`), never GraphQL `gh pr create` first. Merge ONLY if all gates pass (`0 FAIL`, `0 ENV-BLOCKED`); otherwise leave the PR open and print the compare URL and exact local commands.

## 1. GLOBAL RULES (R1..R10)

R1 ES5-STRICT EVERYWHERE. Every shipped `.js` file (`data/app-core.js`, `data/learning-tools.js`, `data/studio.js`, `data/data-meter.js`, `sw.js`, and inline `<script id="sdpSwBoot">` in `index.html`) MUST parse with Acorn `ecmaVersion: 5` and `new Function(src)`, beginning with `'use strict';`. Zero `let`, `const`, arrow functions (`=>`), template literals, `class`, `async`/`await`, `for..of`, destructuring, spread (`...`), or default parameters.

R2 TIGHTENED BYTE CAPS (THE STRUCTURAL GUARD AGAINST LAYER-STACKING).
  - `index.html` <= **110,000 bytes** (down from 485,175 B; holds ONLY `<head>` with `#sdpSwBoot` + static `<style id="sdpCss">`, the clean semantic `<body>` shell with 6 screens, `#gas-source`, and `<script defer src>` tags).
  - `data/learning-tools.js` <= **120,000 bytes** (down from 269,514 B; holds ONLY the single `SDP61` IIFE).
  - `data/app-core.js` <= **420,000 bytes** (new home of the surviving base engine extracted from `index.html` in P2/P4).
  - `data/studio.js` <= **110,000 bytes** (baseline 106,144 B — untouched except version stamp if present).
  - `data.html` and `data/index.html` <= **60,000 bytes** each and MUST remain byte-for-byte identical (`cmp -s data.html data/index.html`).
  - Update `tests/check.cjs` byte assertions in P1 to enforce these exact caps.

R3 SYNCHRONIZED VERSION STAMPS (`9.0.1.0` / `ver: 61`).
  - Set `ver: 61`, `version: "9.0.1.0"`, `appVersion: "9.0.1.0"`, `schema: 61`, `settingsRev: 61` across `version.json`, `data/version.json`, `data/config.json`, `data/session.json`, `data/elevenlabs-audio.json`.
  - Set `APP_VERSION="9.0.1.0"` in `index.html` and `data/app-core.js`.
  - Set `VERSION = 'sdp-v61-9.0.1.0'` and `APP_VERSION = '9.0.1.0'` in `sw.js`.
  - Set `METER_VERSION = '9.0.1.0'` and `SCHEMA = 61` in `data/data-meter.js`.
  - Set headline `v61 · APP_VERSION 9.0.1.0` in `data.html` and `data/index.html`.
  - Append `?v=9.0.1.0` to `<script defer src="./data/app-core.js?v=9.0.1.0">`, `./data/data-meter.js?v=9.0.1.0`, `./data/studio.js?v=9.0.1.0`, and `./data/learning-tools.js?v=9.0.1.0` in `index.html`.

R4 PROTECTED IDENTIFIERS CONTRACT (MUST SURVIVE THE REBUILD).
  - **DOM IDs**: `#app`, `.topbar`, `#sdpBrandCluster`, `#brandName`, `#brandSub`, `#sdpTopActions`, `#sdpTopVoiceBtn`, `#sdpTopLangPill`, `#btnLang`, `#btnGuideTop`, `#btnOpenSettingsTop`, `#chipNet`, `#tabbar`, `#tab-home`, `#tab-dict`, `#tab-comm`, `#tab-set`, `#screen-home`, `#homeAnn`, `#homeResume`, `#sdpHomeGreeting`, `#homeHero`, `#homeKicker`, `#homeTitle`, `#homeSub`, `#sdpHeroConfigChips`, `#btnStart`, `#btnStartText`, `#btnGuide`, `#btnGuideStart`, `#sdpHomeStatsRow`, `#sdpQuickPracticeGrid`, `#credit`, `#creditFoot`, `#creditDocked`, `#screen-dict`, `#dictSearch`, `#sdpWordFilterRow`, `#dictList`, `#screen-comm`, `#screen-practice`, `#btnCompose`, `#screen-set`, `#sdpNextGenSettings`, `#setBody`, `#sdpAppearanceAccordion`, `#rateRange`, `#volRange`, `#repeatsSelect`, `#readSentenceToggle`, `#writeSecsRange`, `#bitrateSelect`, `#btnAdmin`, `#btnTheme`, `#btnPerf`, `#bgLiveWrap`, `#bgLiveVideo`, `#layers`, `#sheets`, `#modals`, `#toasts`, `#dataSheet`, `#guideSheet`, `#sdpCockpitCard`, `#sdpEdgeBar`, `#sdpEdgeBarFill`, `#sdpCockpitHeaderRow`, `#plCount`, `#plStatus`, `#sdpTimerPill`, `#cdNum`, `#cdFg`, `#sdpCockpitStage`, `#plWord`, `#ansInput`, `#ansSlots`, `#sdpCockpitDock`, `#sdpCockpitFoot`, `#plPlay`, `#sdpCockpitCounters`, `#sdpWordMapCard`, `#selfCheck`, `#v58SelfScore`, `#resSummary`, `#ttsMasterAudio`.
  - **JS APIs**: `window.SDPLearning`, `window.SDPPerfGuard`, `window.SDPDataMeter`, `window.ElevenVault`, `Speech.say`, `Speech.speak`, `Speech.playWord`, `Eng.*`, `Screens.*`, `UI.setTab`, `Cloud.sync`, `Cloud.onSync`, `Lib.searchIndex`, `window.SDP_applyLang`.
  - **Storage & Cache Keys**: `sdp.v56_audit_verified`, `sdp-youdao-v1`, `sdp_sw_ver`, `sdp.v2:` PIN salt scheme, `sdp_sr_v2`, `sdp_gam_v2`, `sdp_wrong_words`, `sdp_offline_v60`.
  - **Security Invariants**: `SDP_ENC_V2` (`PBKDF2-SHA256` at `iterations: 250000` + `AES-GCM`), `strictAdminOnly`, `fetchOnce`, `COMPROMISED_PIN`/`COMPROMISED_HASH` blacklist in `tests/check.cjs`.

R5 ZERO-FOUC MOUNT-KEYED STATIC CSS (`#sdpCss` IN `<head>`).
  Exactly ONE `<style>` element may exist in `index.html`, and it is static in `<head>`:
  ~~~html
  <style id="sdpCss">
  html,body{background:#09090B;color:#FAFAFA;font-family:Inter,'Noto Sans Sinhala',system-ui,-apple-system,sans-serif;margin:0;padding:0;overflow-x:hidden}
  #app,.topbar,#tabbar{opacity:0}
  body[data-v61-ready="1"] #app,body[data-v61-ready="1"] .topbar,body[data-v61-ready="1"] #tabbar{opacity:1;transition:opacity .18s ease}
  /* + full v61 Hurubuhuti dark-zinc design system (~30-35 KB, zero @import, zero backdrop-filter) */
  </style>
  ~~~
  `document.body.setAttribute("data-v61-ready", "1")` is called **synchronously at the end of `data/learning-tools.js`** immediately after `SDP61.mount()` finishes building the initial DOM (plus a 1500 ms emergency fail-safe in `#sdpSwBoot` only if a script fails to load). Because all `defer` scripts execute in order (`app-core.js` -> `data-meter.js` -> `studio.js` -> `learning-tools.js`) before first paint, the user NEVER sees an unstyled or legacy frame.

R6 SINGLE-UI ENFORCEMENT INVARIANT (CHECKED AT EVERY COMMIT AFTER P3).
  After P3, all three commands below MUST return `0` across every shipped file:
  ~~~sh
  grep -c 'id="sdpV57Css"\|id="sdpV58Css"\|id="sdpLearnCss"\|id="sdpV59Css"\|id="sdpDataSheetCss"\|id="sdpNextGenCss"' index.html data/learning-tools.js data/app-core.js
  grep -c 'v604All\|v604SweepTopbar\|v604Keeper\|sdpLegacyPlayerDock\|sdpPrePaintCloak' index.html data/learning-tools.js data/app-core.js
  grep -c 'data-v60-legacy\|data-v58-en\|data-v58-si' index.html data/learning-tools.js data/app-core.js
  ~~~
  Runtime CSS injection (`createElement('style')` / `createElement("style")`) is banned in `index.html`, `data/app-core.js`, and `data/learning-tools.js`.

R7 ENGINE SPEECH CALLS ARE ARRAYS (KILLS THE LETTER-SPELLING BUG FOREVER).
  - Inside `Speech.say(e, t, n)` in `data/app-core.js` (extracted from `index.html ~offset 408,188`), the very first statements MUST be:
    `if (e == null) e = []; if (typeof e === "string" || typeof e === "number") e = [String(e)]; if (!t) t = {};`
  - Every `Speech.say(...)` call site in `data/app-core.js` and `data/learning-tools.js` MUST pass an array literal (`["..."]` or `[w.w]`), verified by grep in P4.

R8 ONE BOOT, ZERO TIMERS BEFORE MOUNT & ZERO SCROLL-YANK.
  - Zero `setTimeout`, `setInterval`, `requestAnimationFrame`, or `MutationObserver` may run in `data/learning-tools.js` before `data-v61-ready="1"` is set.
  - Delete `watchHead` / head-observer CSS fights outright.
  - Delete the v58-era `#ansInput` auto-focus timer (`setTimeout(function(){inp.focus();},80)` at `index.html ~offset 234,650`) that yanked the dictation player down to `.ctrlgrid` on every writing beat.

R9 STUDENT-FIRST 3-GROUP SETTINGS CONTRACT (`#screen-set`).
  `#screen-set` renders `#sdpNextGenSettings` containing strictly three groups in this order:
  1. **PRIORITY 1 · DICTATION & LEARNING**: Practice/Answer mode (`Paper | Typing`), Voice speed (`0.75× Slow | 0.90× Clear | 1.0× Normal`), Word repeats (`1× | 2× | 3×` — single control), Writing time per word (`3–15 s` slider `#writeSecsRange` setting `writeMode="fixed"` and `writeFixed`), Auto-read example sentence (`#readSentenceToggle`), Interface language (`English | සිංහල`).
  2. **PRIORITY 2 · VOICE & AUDIO CHECK**: Active voice card (`🇬🇧 Alice · UK Studio Voice`, `eleven_flash_v2_5`) + working `[Test voice]` button (`Speech.say(["This is Alice, your UK English dictation voice."], {rate:0.9,volume:1}, function(){})`) + Volume slider (`#volRange`).
  3. **PRIORITY 3 · APPEARANCE (OPTIONAL)**: Collapsed `<details id="sdpAppearanceAccordion">` (`open = false` by default) containing `#setBody` with optional themes (`#btnTheme`), performance mode (`#btnPerf`), optional wallpapers (`#bgLiveWrap`, `#bgLiveVideo`), backup/restore, `#rateRange`, `#repeatsSelect`, `#bitrateSelect`, and Lecturer Studio (`#btnAdmin`).
  Zero elements may render outside these three groups: the v58 `"Paste blocked?..."` helper (`#pasteHelper`), the duplicate `#repeatsSelect`, and the v58 footer are DELETED, not hidden.

R10 LANGUAGE PURITY (`EN` vs `සිංහල`).
  - `EN` mode = 100% English across all screens, cards, toasts, and credits (the ONLY Sinhala glyph allowed in EN mode is on the `EN | සිංහල` language toggle pill itself, plus the collapsed `සිංහල · <meaning>` study chip on Word Cards).
  - `SI` mode = 100% natural Sri Lankan Sinhala driven by a single `T(key)` lookup table in `SDP61` (using natural educator phrasing: `මුල් පිටුව`, `වචන`, `අසා ලිවීම`, `පුහුණුව`, `සැකසුම්`, `වචන කාඩ්පත්`, `බහුවරණ ප්‍රශ්න`, `වාක්‍ය හිස්තැන් පිරවීම`, `මගේ අපහසු වචන`, `ක්‍රියා කරන ආකාරය · තත්පර 60ක උපදෙස්`).

---

## 2. PHASES (P0..P6)

### P0 · Preflight, Helpers & Anchor Inventory (budget <= 6 tool calls)
1. Do W1 and W2. Create `.work/v61/` and write `.work/v61/peek.cjs`, `.work/v61/patchlib.cjs`, and `.work/v61/strgen.cjs` from Section 3.
2. Record `git rev-parse HEAD` (expected `3066550` v9.0.0.4 or `ef6cdfa` v9.0.0.3) and baseline file sizes (`wc -c index.html data/learning-tools.js data/studio.js data/data-meter.js data.html data/index.html sw.js`) into `.work/v61/PROGRESS.md`.
3. Run a single batch script to record the P0 anchor inventory into `.work/v61/anchors.md` (`grep -c` counts in `index.html` and `data/learning-tools.js` for: `sdpV57Css`, `sdpV58Css`, `sdpLearnCss`, `sdpV59Css`, `sdpDataSheetCss`, `sdpNextGenCss`, `v604All`, `creditDocked`, `setTimeout(`, `MutationObserver`, `Screens.home`, `Speech.say`, `wrapTabset|wrapHome|wrapPaint|wrapSettings|wrapDict|wrapCockpit`, `guide-si-`).
4. Run baseline non-browser gates once (`timeout 120 node tests/check.cjs > /tmp/p0-check.log 2>&1; timeout 300 node tests/upgrade.test.cjs > /tmp/p0-up.log 2>&1; echo "exit=$?"`) and probe Chromium availability (`command -v chromium chromium-browser google-chrome 2>/dev/null; ls ~/.cache/ms-playwright 2>/dev/null`). Record in `.work/v61/PROGRESS.md`.
5. Commit `"v61 P0: preflight, helpers, and anchor inventory"` and push.

### P1 · Gate Liberation — Rewrite the 9 Suites to the v61 Contract (budget <= 8 tool calls)
Goal: Rewrite the test suites FIRST so they forbid legacy v57/v58/v59/v604 layers (`LEGACY_ABSENT`) and require the clean v61 single-UI architecture (`V61_PRESENT`), while keeping every security, PIN, vault, meter, and pedagogical self-check test intact.
1. **`tests/check.cjs`**:
   - Update `checkInline('index.html', 'app', 600000)` byte ceiling to **`110000`** (`110 KB`), add `data/learning-tools.js` ceiling **`120000`** (`120 KB`), add `data/app-core.js` ceiling **`420000`** (`420 KB`) + ES5 Acorn parse check on `data/app-core.js`.
   - For engine/security source checks that previously grepped `INDEX` (`index.html`), read `var APP_SRC = INDEX + (fs.existsSync('data/app-core.js') ? '\n' + fs.readFileSync('data/app-core.js', 'utf8') : '');` so engine invariants (`APP_VERSION="9.0.1.0"`, `iterations: 250000`, `writeSecs`, `createMediaElementSource` ban, `Speech.say` array guard) inspect `APP_SRC`.
   - In the JSDOM execution harness of `tests/check.cjs` (if present), load `data/app-core.js` before `data/learning-tools.js`.
   - Delete the legacy trap assertions from `tests/check.cjs` (lines 105–175 at `ef6cdfa`: `sdpV58Css`, `v58-glass-blur`, `v58-core`, `v58Dock|v58-keyboard`, `aboutCreditsSheet|v58-sig-pill`, `v58WorkSpace`, `data-v58-en` count, `guide:"User Guide"`, `sdpV59Css`, `--fs-meta:14px|--v59-card`, `CRUSH_MQ`, `v58-tile-t i`, `v59-dict-card|v59-ipa|v59-pos|v59-si-chip`, `v58ContextNextBtn`, `applyLang/syncI18n`, `sdpNextGenCss`, neutralised style checks).
   - Replace them with:
     - **`LEGACY_ABSENT` gate**: Assert that none of `sdpV57Css`, `sdpV58Css`, `sdpLearnCss`, `sdpV59Css`, `sdpDataSheetCss`, `sdpNextGenCss`, `v604All`, `v604SweepTopbar`, `sdpLegacyPlayerDock`, `sdpPrePaintCloak`, `data-v60-legacy`, `data-v58-en`, `data-v58-si`, `v58-sig-pill`, `v58-tile`, `v59-dict-card` appear in `index.html`, `data/app-core.js`, or `data/learning-tools.js`!
     - **`V61_PRESENT` gate**: Assert `id="sdpCss"` in `index.html`, `data-v61-ready` in `index.html` and `data/learning-tools.js`, `#sdpWordFilterRow`, `.sdp-word-card`, `#sdpCockpitCard`, `#sdpEdgeBar`, `#sdpTimerPill`, `#sdpCockpitDock`, `#sdpWordMapCard`, `#sdpNextGenSettings`, `#sdpAppearanceAccordion`, `#guideSheet`, `#creditFoot` / `#creditDocked` with `position:static`, `levenshteinOps`, `markMissed`, `markCorrect`, `v58SelfScore`, `resSummary`, `audio/mp4`, `Play my recording`, `offlineReadyCount`, and `typeof e==="string"` / `typeof items==="string"` in `Speech.say`.
     - Update version stamp assertions to `ver: 61`, `"9.0.1.0"`, `sdp-v61-9.0.1.0`, and remove the requirement for `guide-si-1.mp3` in `sw.js` `SHELL` (per W9).
2. **`tests/upgrade.test.cjs`**:
   - Keep all vault (`SDP_ENC_V2`), relay, meter, and 30-row paper self-check (`"0 / 30 · 0%"` -> `"2 / 30 · 7%"`) behavioral tests; update version expectations to `9.0.1.0` / `61`; update marker list to v61 markers (`#sdpCss`, `data-v61-ready`, `#sdpCockpitCard`, `#sdpNextGenSettings`, `#sdpWordFilterRow`, `#guideSheet`, `#creditFoot`); allow engine source checks to read `index.html` + `data/app-core.js`.
3. **`tests/browser.cjs`, `tests/upgrade-browser.cjs`, `tests/e2e.cjs`, `tests/phase1.cjs`, `tests/server.cjs`, `tests/live-lab.cjs`, `tests/audit-v42.cjs`**:
   - Retarget version stamps to `9.0.1.0` / `61` / `sdp-v61-9.0.1.0`.
   - Retarget legacy `v58*`/`v59*` DOM selectors in `browser.cjs`, `upgrade-browser.cjs`, and `e2e.cjs` to their v61 equivalents (`#sdpQuickPracticeGrid`, `#sdpCockpitCard`, `#sdpNextGenSettings`, `#guideSheet`, `#creditFoot`, `/data` route).
   - Add the **FOUC & Single-UI Browser Probes** to `tests/upgrade-browser.cjs`:
     1. `document.querySelector('body[data-v61-ready="1"]')` exists within 50 ms of `DOMContentLoaded` and `getComputedStyle(document.getElementById('app')).opacity === '1'`.
     2. `document.querySelectorAll('style').length <= 2` (only `#sdpCss` + optional font face; zero `#sdpV57Css`/`#sdpV58Css`/`#sdpNextGenCss`).
     3. `.topbar` has `top === 0`, `height <= 56`, `backdropFilter === 'none'`, and contains only `#sdpBrandCluster` and `#sdpTopActions`.
     4. `#creditFoot` / `#creditDocked` has `getComputedStyle(el).position === 'static'`.
     5. Clicking `#tab-dict` (`Words`) synchronously renders 30 visible `.sdp-word-card` cards (`height > 50`).
     6. Clicking `#btnStart` opens `#sdpCockpitCard` directly with `.layer.player .lbody.scrollTop === 0` and `0` `.ctrlgrid` elements in DOM.
     7. Clicking `[Test voice]` passes an Array to `Speech.say` and triggers `0` error toasts.
4. Commit `"v61 P1: liberate all 9 test gates to enforce single-UI v61 contract"` and push. *(Note: `check.cjs` will intentionally fail at the end of P1 until P2, P3, and P4 complete the file surgery.)*

### P2 · `index.html` Surgery & Engine Extraction to `data/app-core.js` (budget <= 8 tool calls)
Goal: Extract the inline base engine from `index.html` into `data/app-core.js`, delete all legacy v57/v58/v59/v604 CSS and JS injectors from `index.html`, replace the 56 KB static `<style>` with the single `~35 KB` `<style id="sdpCss">`, and rebuild the static `<body>` shell so `wc -c index.html` is **<= 110,000 bytes**.
1. Use `peek.cjs` on `index.html` to find the exact byte offsets of:
   - `<head>` and `#sdpSwBoot` / `#sdpPrePaintCloak`
   - The 56,169-byte static `<style>` block (`bytes ~1,718–57,902`)
   - The `<body>` HTML markup (`#app`, `.topbar`, `#tabbar`, `#screen-home`, `#screen-dict`, `#screen-comm`, `#screen-set`, `#gas-source`)
   - The 396,254-byte inline `<script>` (`bytes ~87,694–479,416`) and any trailing v60/v604 inline scripts.
2. Write and run a deterministic Node script `.work/v61/p2-surgery.cjs`:
   - **Step 2a — Extract `data/app-core.js` (`<= 420,000` bytes)**:
     - Extract the inline application `<script>` body into `data/app-core.js` (starting with `'use strict';`).
     - Strip from `data/app-core.js` the appended v57/v58 runtime patch blocks:
       - Delete the `#sdpV57Css` injector (`l.id="sdpV57Css"` block),
       - Delete the `#sdpV58Css` injector (`l58.id="sdpV58Css"` block),
       - Delete the `#sdpDataSheetCss` injector (`f.id="sdpDataSheetCss"` block),
       - Delete the v58 topbar overflow menu regroup builder,
       - Delete the duplicate `#repeatsSelect` builder (`d.id="repeatsSelect"` at tail) and `#pasteHelper` (`"Paste blocked?..."` at tail),
       - Delete the v58 `Session progress` bar injector and v58 static footer updater.
     - Keep intact in `data/app-core.js`: `U`, `Sha`, `DB`, `Lib`, `Speech`, `NoVoice`, `Diag`, `Eng`, `Results`, `UI`, `Screens`, `Admin`, `Cloud`, `Share`, `SDPSessionSecrets`, `ElevenVault` (`SDP_ENC_V2` at `iterations: 250000`).
     - Verify `data/app-core.js` parses cleanly with `new Function(src)` and Acorn `ecmaVersion: 5`.
   - **Step 2b — Author Clean `index.html` (`<= 110,000` bytes)**:
     - `<head>`:
       - Meta tags + title + `<script id="sdpSwBoot">` (comparing `localStorage.getItem("sdp_sw_ver")` against `"9.0.1.0"`, deleting stale caches except `"sdp-youdao-v1"`, updating SW registrations, and setting a 1500 ms fail-safe `document.body.setAttribute("data-v61-ready","1")`).
       - Single static `<style id="sdpCss">` (`~30–35 KB`, zero `@import`, zero `backdrop-filter`) containing:
         - The mount-keyed cloak (`#app,.topbar,#tabbar{opacity:0} body[data-v61-ready="1"] #app,body[data-v61-ready="1"] .topbar,body[data-v61-ready="1"] #tabbar{opacity:1;transition:opacity .18s ease}`),
         - Full v61 Hurubuhuti dark-zinc design tokens (`--bg-canvas:#09090B`, `--bg-card:#18181B`, `--bg-elevated:#222226`, `--border-subtle:rgba(255,255,255,0.08)`, `--text-primary:#FAFAFA`, `--text-secondary:#A1A1AA`, `--accent:#38BDF8`, `--listen:#38BDF8`, `--write:#FBBF24`, `--review:#4ADE80`, `--danger:#F87171`),
         - Solid 56px `.topbar` (`position:fixed;top:0;left:0;right:0;height:56px;background:#09090B;border-bottom:1px solid rgba(255,255,255,0.08);z-index:80;display:flex;align-items:center;justify-content:space-between;padding:0 14px`),
         - `#app` (`padding:68px 14px 96px;max-width:540px;margin:0 auto`),
         - 5-tab `#tabbar` (`position:fixed;left:12px;right:12px;bottom:10px;height:62px;background:#121215;border:1px solid rgba(255,255,255,0.10);border-radius:20px;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:5px;z-index:75`),
         - Complete component styles for `#homeHero`, `#sdpHomeStatsRow`, `#sdpQuickPracticeGrid`, `.sdp-word-card`, `#sdpWordFilterRow`, `#sdpCockpitCard`, `#sdpEdgeBar`, `#sdpTimerPill`, `#sdpLetterSlots`, `#sdpCockpitDock`, `#sdpWordMapCard`, `#sdpNextGenSettings`, `#guideSheet`, `#selfCheck .selfrow`, `#credit`, and static `#creditFoot` (`position:static;margin:18px auto 6px;display:flex;justify-content:center`).
     - `<body>` (`class="sdp-v61" data-theme="dark" data-perf="auto"`):
       - SVG icon sprite `<svg id="icn" ...>` (preserved from `index.html`).
       - `#app`:
         - `.topbar`: `#sdpBrandCluster` (swan badge + `#brandName` `"Smart Dictation"` + `<span id="sdpVerPill">v61</span>` + `#brandSub` `"CCBE Galle Branch"`) and `#sdpTopActions` (`#sdpTopVoiceBtn`, `#sdpTopLangPill` / `#btnLang` `"EN | සිංහල"`, `#btnGuideTop`, `#btnOpenSettingsTop`). Keep hidden `#chipNet` inside a non-visual span so `UI.renderNet()` never throws.
         - `#tabbar`: 5 buttons (`#tab-home` `Home`, `#tab-dict` `Words`, `#tab-prac` `Practice`, `#tab-comm` `Community`, `#tab-set` `Settings`).
         - `#screen-home`: `#homeAnn`, `#homeResume` (`#resumeText`, `#resumeSub`, `#btnResumeNo`, `#btnResumeYes`), `#sdpHomeGreeting`, `#homeHero` (`#homeKicker`, `#homeTitle`, `#homeSub`, `#sdpHeroConfigChips`, `#btnStart` with `#btnStartText` + `#sdpBtnStartEst`, `#btnGuide` `"How it works · 60s guide"`), `#sdpHomeStatsRow`, `#sdpQuickPracticeGrid`, and static `#creditFoot` (`#creditDocked` `"🦢 Crafted by Hansana"`). (Keep hidden stubs for `#homeMeta`, `#segMode`, `#homeStats`, `#homeSessions` only if `data/app-core.js` `Screens.home` writes to them before P4 cleans `Screens.home`.)
         - `#screen-dict`: `#dictSearch`, `#sdpWordFilterRow`, `#dictList` (plus hidden `#dictTabs`).
         - `#screen-comm` & `#screen-practice`: practice hub container + community container (`#commSummary`, `#btnCompose`, `#commWho`, `#commFilters`, `#commList`, `#btnMsg`, `#msgFallback`).
         - `#screen-set`: `#sdpNextGenSettings` + `<details id="sdpAppearanceAccordion"><summary>Appearance &amp; Lecturer Studio (Optional)</summary><div id="setBody"></div></details>` (plus hidden `#bgLiveWrap`, `#bgLiveVideo`).
         - `#printview`, `#layers`, `#sheets`, `#modals`, `#toasts`, `#live`, `#fatal`, `<audio id="ttsMasterAudio" preload="none"></audio>`, and `<script type="text/plain" id="gas-source">...</script>`.
       - Deferred scripts at end of `<body>`:
         ~~~html
         <script src="./data/app-core.js?v=9.0.1.0" defer></script>
         <script src="./data/data-meter.js?v=9.0.1.0" defer></script>
         <script src="./data/studio.js?v=9.0.1.0" defer></script>
         <script src="./data/learning-tools.js?v=9.0.1.0" defer></script>
         ~~~
3. Verify: `wc -c index.html` <= **110,000**; `wc -c data/app-core.js` <= **420,000**; `grep -c 'id="sdpV57Css"\|id="sdpV58Css"\|id="sdpDataSheetCss"\|sdpPrePaintCloak' index.html data/app-core.js` -> **0**.
4. Commit `"v61 P2: index.html surgery (<=110KB) and engine extraction to data/app-core.js"` and push.

### P3 · `data/learning-tools.js` Amputation & Single `SDP61` Module (budget <= 8 tool calls)
Goal: Replace the 269,514-byte 4-generation `data/learning-tools.js` with ONE clean ES5 IIFE (`SDP61`, **<= 120,000 bytes**) that mounts synchronously with zero `setTimeout`s before `data-v61-ready="1"` and implements Words Explorer, Practice Hub, 6-Step Bilingual User Guide, 3-Group Settings, Self-Check/Mastery Loop, Load Micro-Toast, and Static Credit Pill.
1. Write and run a generator script `.work/v61/p3-build-sdp61.cjs` (using `\uXXXX` escapes via `strgen.cjs` logic) that writes `data/learning-tools.js` (`<= 120,000 bytes`, `'use strict';`, Acorn ES5-verified) containing:
   - **Section 1 — Core Helpers & Unified Bilingual Dictionary (`T(key)`, `window.SDP_applyLang(lang)`)**:
     - Single i18n dictionary (`EN` and natural Sri Lankan `SI` strings, R10).
     - `window.SDP_applyLang(lang)` updates `DB.data.settings.lang`, re-renders active screen labels synchronously, and keeps `EN` 100% English (except the `EN | සිංහල` pill and collapsed Sinhala word-card study chip) and `SI` 100% natural Sinhala.
   - **Section 2 — Preserved Pedagogical & Storage Engines (R4, R6)**:
     - `SDPOfflineDB` (`sdp_offline_v60` IndexedDB + `localStorage` fallback).
     - `window.SDPPerfGuard` (`perf: "auto"` default, zero idle timers).
     - Weak-words bank & FSRS-lite streak graduation (`markMissed`, `markCorrect`, `loadMasteredWords`, `localStorage['sdp.v56_audit_verified']`), `levenshteinOps` diff coach.
     - Paper-mode 30-row interactive self-check (`#selfCheck`, `.selfrow`, live score `#v58SelfScore` updating `"0 / 30 · 0%"` -> `"2 / 30 · 7%"`, feeding `#resSummary` and Weak Words) + 6-column A4 printable study sheet (`#printview`).
     - Offline Pack downloader with honest counter semantics (`offlineReadyCount = saved`, `sdp-youdao-v1` cache).
   - **Section 3 — Synchronous Home Screen Owner (`Screens.home`)**:
     - Updates `#sdpHomeGreeting` (`Good evening, Student` · `Session 8`), `#homeHero` (`#homeKicker`, `#homeTitle`, `#homeSub` `"30 adjectives · UK English · 🇬🇧 Alice studio voice"`, `#sdpHeroConfigChips` 4 live pills `Paper mode`, `0.90×`, `×2 repeats`, `8s write`, `#btnStart` with `≈ 6 min`, `#btnGuide` `"How it works · 60s guide"`), `#sdpHomeStatsRow` (`STREAK`, `MASTERED`, `WEAK WORDS`), `#sdpQuickPracticeGrid` (`Flashcards`, `Quiz`, `Sentence gap`, `Weak words` with count badge), and static `#creditFoot` (`#creditDocked`).
   - **Section 4 — Synchronous Words Explorer Owner (`Screens.dict` — Fixes Blank Words Tab)**:
     - Reads live words from `(Lib && Lib.current() && Lib.current().words) || (DB && DB.data && DB.data.lists && DB.data.lists[0] && DB.data.lists[0].words) || []` (count derived from `words.length`, never hardcoded `/30`).
     - Wires `#dictSearch` and `#sdpWordFilterRow` (`All · Weak · Mastered · A–Z` buttons with `aria-pressed`).
     - Synchronously renders numbered `.sdp-word-card` cards (`1..N`) into `#dictList`: number badge, bold headword (`w.w`), Sky-400 UK IPA (`/` + `w.p` + `/`), italic POS (`w.pos`), full English definition (`w.m`), full example sentence (`w.s`) with target word bolded, Sinhala meaning pill (`සිංහල · ` + `w.si`), and right-aligned `[▶ Play]` (`Speech.say([w.w], {rate: st.rate || 0.9}, ...)`) and `[🐢 Slow]` (`Speech.say([w.w], {rate: 0.72}, ...)`) buttons.
   - **Section 5 — Unified Practice Hub (`#screen-comm` / `#screen-practice`)**:
     - Renders all 6 practice tools in one dark-zinc card style:
       1. `Flashcards` (full-field flip card)
       2. `4-Choice Quiz` (choice cards + auto-advance)
       3. `Sentence Gap` (clue sentence + real working Next Question button `#sdpContextNextBtn` / `#v58ContextNextBtn` advancing to next word; Mistake Coach shown ONLY on misses, never on correct answers)
       4. `Weak Words Drill` (drills missed words & graduates at streak >= 3)
       5. `Speak & Compare` (`MediaRecorder` with `audio/mp4` MIME selection + explicit `"Play my recording"` button, or honest `"Recording not supported on this device"` state when `MediaRecorder` is absent)
       6. `Audio List` (dynamic count `words.length`, never hardcoded `/30`).
   - **Section 6 — 6-Step Bilingual User Guide Sheet (`#guideSheet`, W9)**:
     - Triggered by `#btnGuide` and `#btnGuideTop`.
     - Displays the 6 onboarding steps with an independent per-guide `EN | සිංහල` language selector and `#btnGuideStart` (`"Start practising now"` -> closes sheet and starts/focuses dictation).
     - Audio button per step plays committed `si-LK` / `en-GB` guide clip if present in `elevenlabs-audio.json`, or device TTS if a matching voice exists, or shows the honest disabled label `"Audio not recorded yet"` (never a silent stub or Youdao `le=si`).
   - **Section 7 — Student-First 3-Group Settings Owner (`Screens.settings`, R9)**:
     - Synchronously renders `#sdpNextGenSettings` (Group 1: Dictation & Learning; Group 2: Voice & Audio Check with `[Test voice]` calling `Speech.say(["This is Alice, your UK English dictation voice."], {rate:st.rate||0.9,volume:st.volume||1}, function(){})`; Group 3: collapsed `<details id="sdpAppearanceAccordion">` wrapping `#setBody`).
   - **Section 8 — Telemetry Micro-Toast & Static Credit Pill + Synchronous Mount**:
     - `microToastLoad` (`⚡ 0.34 MB used on load`, 3.5 s post-mount, `pointer-events:none`) and `#credit` shimmer (`🦢 CREDITS GOES TO Hansana`, 3.5 s post-mount, `pointer-events:none`) docking into static `#creditFoot` (`#creditDocked`).
     - At the end of `SDP61.mount()` (executed synchronously when `data/learning-tools.js` runs): calls `document.body.setAttribute("data-v61-ready", "1");`.
2. Verify:
   - All R6 Single-UI greps print **`0`**.
   - `wc -c data/learning-tools.js` <= **120,000**.
   - `node --check data/learning-tools.js` exits `0`.
3. Commit `"v61 P3: amputate stacked layers in learning-tools.js (<=120KB) and ship single SDP61 module"` and push.

### P4 · Engine Hardening in `data/app-core.js`, Speech Array Guard & Sync/SW Alignment (budget <= 6 tool calls)
Goal: Harden `Speech.say` inside `data/app-core.js` (R7), remove the `#ansInput` 80ms focus scroll-yank (R8), wire `Cloud.onSync` for clean cross-device re-renders, remove the 6 fake `guide-si-*.mp3` stubs (W9), and update all version stamps to `9.0.1.0` / `ver: 61` / `sdp-v61-9.0.1.0`.
1. Write and run `.work/v61/p4-engine.cjs` using `patchlib.cjs` on `data/app-core.js`:
   - **1. `Speech.say` Array Hardening (R7)**:
     - Locate `say=function(e,t,n){var i=this,s=e||[]` (or equivalent in `data/app-core.js`). Insert at the start of `Speech.say`:
       `if (e == null) e = []; if (typeof e === "string" || typeof e === "number") e = [String(e)]; if (!t) t = {};`
     - Verify with `grep -n "Speech.say(" data/app-core.js data/learning-tools.js` that every call site passes an array.
   - **2. Delete `#ansInput` +80ms Auto-Focus Scroll-Yank (R8)**:
     - Locate `setTimeout(function(){try{inp.focus()}catch(e){}},80)` (or minified equivalent `inp.focus()` inside the `write` beat of `Eng.runBeat` in `data/app-core.js`) and remove the auto-focus timer so typing mode focuses `#ansInput` only when the student taps it.
   - **3. Delete Ready-Sheet Blocking on `Eng.start()`**:
     - In `Eng.start()`, replace `this.openPlayer(); this.readyScreen();` with `Speech.unlock(); this.requestWake(); this.openPlayer(); this.runItem(0);` (keep `Eng.readyScreen = function(){};` as a callable no-op for unit tests).
   - **4. Cross-Device `Cloud.onSync` Hook**:
     - When `Cloud.applyState` / `Cloud.bootSync` completes in `data/app-core.js`, trigger `if (typeof Cloud.onSync === "function") Cloud.onSync();` so `SDP61` refreshes the active screen once without running legacy v58 builders.
2. **Delete Fake 11-Byte Audio Stubs (W9) & Update `sw.js` + JSON Stamps (R3)**:
   - Run `git rm -f assets/audio/guide-si-1.mp3 assets/audio/guide-si-2.mp3 assets/audio/guide-si-3.mp3 assets/audio/guide-si-4.mp3 assets/audio/guide-si-5.mp3 assets/audio/guide-si-6.mp3` (if present).
   - Update `sw.js`: set `VERSION = 'sdp-v61-9.0.1.0'`, `APP_VERSION = '9.0.1.0'`; add `'./data/app-core.js'` to `SHELL`; remove `'./assets/audio/guide-si-1.mp3'` .. `'guide-si-6.mp3'` from `SHELL`; keep fault-tolerant per-entry install caching, `sdp-youdao-v1` preservation, and Range/206 support.
   - Update `version.json`, `data/version.json`, `data/config.json`, `data/session.json`, `data/elevenlabs-audio.json`, `data/data-meter.js`, `data.html`, and `data/index.html` (`cmp -s data.html data/index.html`) to `ver: 61` / `"9.0.1.0"`.
3. Run cheap check: `timeout 120 node tests/check.cjs && timeout 300 node --test tests/upgrade.test.cjs` and verify `wc -c data/app-core.js` <= **420,000**.
4. Commit `"v61 P4: harden Speech.say array contract, remove focus scroll-yank, and align 9.0.1.0 sync/SW"` and push.

### P5 · The Single-Screen Dictation Cockpit (budget <= 6 tool calls)
Goal: Rebuild `Eng.openPlayer`, `Eng.paint`, and `Eng.paintCountdown` across `data/app-core.js` and `data/learning-tools.js` so that `.layer.player` renders ONLY the single `#sdpCockpitCard` + `#sdpCockpitCounters` + `#sdpWordMapCard` with zero legacy chrome and zero scrolling.
1. Write and run `.work/v61/p5-cockpit.cjs` to ensure `Eng.openPlayer`, `Eng.paint`, and `Eng.paintCountdown` output **exclusively** the Section 3.2 specification:
   - **Player Header (`.lhead`)**: Left = `32×32px` cyan swan badge + `Dictation` (`Session 8 · Personal Feelings, Opinions & Experiences`); Right = `[👁️ Show word]` toggle (`aria-pressed`), `[Finish]` pill (`Eng.finishEarly()`), and `[✕]` close button.
   - **Single Cockpit Card (`#sdpCockpitCard` inside `.layer.player .lbody`)**:
     - **4px Top-Edge Phase Bar (`#sdpEdgeBar` + `#sdpEdgeBarFill`)**: Sky-400 (`#38BDF8`, class `phasebar listen`) during `speaking`/`Listening` -> Amber-400 (`#FBBF24`, class `phasebar write`) during `waiting`/`Writing time` -> Emerald-400 (`#4ADE80`, class `phasebar reveal`) during `Word revealed`.
     - **Single Header Row (`#sdpCockpitHeaderRow`)**:
       - Left (`#plCount`): `Word N of M` (`N = this.idx + 1`, `M = this.words.length`, never hardcoded `30`).
       - Center (`#plStatus`): Phase chip (`● Listening 1/2`, `● Writing time`, `● Word revealed`).
       - Right (`#sdpTimerPill`): `34px` pill containing `#cdNum` (`05.0s`, `font-variant-numeric: tabular-nums`) + `24px` SVG micro-ring (`#cdFg` with `stroke-dasharray` / `stroke-dashoffset` updated by `Eng.paintCountdown(left, total)`).
     - **Center Stage (`#sdpCockpitStage`)**:
       - Kicker: `DICTATION N`.
       - Paper mode: letter slot boxes `□ □ □ …` (`#ansSlots`, one `36×44px` box per character of `currentWord().w`); Typing mode: clean `#ansInput` (`font-size: 16px`, Enter advances).
       - Full word reveal (`#plWord` + IPA + meaning) shown only on reveal beat or when `this.showWord` is true.
       - Caption: `Write on paper · the word was read twice` (or typing instruction).
     - **4 In-Card Helpers (`#sdpCockpitDock`)**: `Repeat` (`Eng.repeatWord()`), `Slower` (`Eng.slower()`), `Sentence` (`Eng.repeatSentence()`), `Spell it` (`Eng.spellWord()`).
     - **Compact Footer (`#sdpCockpitFoot`)**: Left = `🇬🇧 Alice · studio voice · 0.90×`; Right = `[⏸ Pause]` (`#plPlay`, `Eng.playPause()`) + `[⏭ Next/Skip]` (`Eng.next()`).
   - **Below `#sdpCockpitCard`**:
     - `#sdpCockpitCounters`: 3-column live strip (`CORRECT`, `MISSED`, `STREAK`).
     - `#sdpWordMapCard`: `Word map` (`N / M`) + `10×3` numbered buttons (`1..M`) jumping to or indicating past/current/upcoming words.
   - **Zero Legacy Chrome**: Do NOT build `.lens`, `#plRing`, `#plBars` (6 dots), `.ctrlgrid` (7-button block), or `.lfoot` (`[Finish early | Restart]`). `.layer.player .lbody` contains ONLY `#sdpCockpitCard`, `#sdpCockpitCounters`, and `#sdpWordMapCard`, and `scrollTop` stays `0` across all beats.
   - **End of Session (`Eng.finish` / `Results.show`)**: Paper mode renders the interactive 30-row self-check (`#selfCheck .selfrow` with `✓ Got it` / `✗ Missed it` buttons, live `#v58SelfScore`, feeding `markMissed`/`markCorrect` + FSRS-lite mastery); Typing mode renders auto-check; both populate `#resSummary`.
2. Verify:
   - Run `timeout 120 node tests/check.cjs && timeout 300 node tests/upgrade.test.cjs && timeout 120 node tests/phase1.cjs && timeout 120 node tests/server.cjs`.
   - Confirm R6 Single-UI greps all return **`0`**.
3. Commit `"v61 P5: single-screen dictation cockpit with zero legacy chrome and zero auto-scroll"` and push.

### P6 · Release Verification, 9-Gate Run, PR & Merge (budget <= 8 tool calls)
Goal: Run all 9 release gates (including real Chromium browser gates, FOUC probe, and two-device live-lab), update `CHANGELOG.md`, remove `.work/v61`, and open/merge the PR.
1. Run all 9 gates with timeouts (W5):
   - `timeout 120 node tests/check.cjs > /tmp/g1-check.log 2>&1; echo "G1=$?"`
   - `timeout 300 node --test tests/upgrade.test.cjs > /tmp/g2-upgrade.log 2>&1; echo "G2=$?"`
   - `timeout 120 node tests/phase1.cjs > /tmp/g3-phase1.log 2>&1; echo "G3=$?"`
   - `timeout 120 node tests/server.cjs > /tmp/g4-server.log 2>&1; echo "G4=$?"`
   - `timeout 420 node tests/browser.cjs > /tmp/g5-browser.log 2>&1; echo "G5=$?"`
   - `timeout 420 node tests/upgrade-browser.cjs > /tmp/g6-upbrowser.log 2>&1; echo "G6=$?"`
   - `timeout 420 node tests/e2e.cjs > /tmp/g7-e2e.log 2>&1; echo "G7=$?"`
   - `timeout 300 node tests/live-lab.cjs > /tmp/g8-livelab.log 2>&1; echo "G8=$?"`
   - `timeout 300 node tests/audit-v42.cjs > /tmp/g9-audit42.log 2>&1; echo "G9=$?"`
   Fix any selector or assertion mismatch (max 3 attempts per gate, W7; never violate R2 byte caps or R6 single-UI invariant).
2. Update `CHANGELOG.md` with the `v61 / 9.0.1.0` release entry documenting:
   - What was deleted (layers 1–5, `#sdpV57Css`, `#sdpV58Css`, `#sdpLearnCss`, `#sdpV59Css`, `#sdpDataSheetCss`, `#sdpNextGenCss`, `v604All` janitor, six 11-byte `guide-si-*.mp3` stubs),
   - Before -> after byte counts (`index.html`: `485,175 B -> <110,000 B`; `data/learning-tools.js`: `269,514 B -> <120,000 B`; `data/app-core.js`: `<420,000 B`),
   - All 9 live video defects resolved.
3. Remove `.work/v61` (`git rm -rf .work/v61`), re-run `node tests/check.cjs && node --test tests/upgrade.test.cjs` and the R6 grep checks one final time, commit `"Release v61 / 9.0.1.0: Single-Pass Rebuild (One App, One UI, Zero Layers)"`, and `git push -u origin HEAD`.
4. Open or reuse the single PR (W10): use built-in PR tool or REST `gh api repos/dictationb1/dictationb1.github.io/pulls -f title="Release v61 / 9.0.1.0 — Single-Pass Rebuild (One App, One UI, Zero Layers)" -f head="$(git branch --show-current)" -f base=main -f body="..." --jq '.number'`. Merge ONLY if all 9 gates G1..G9 are PASS (zero FAIL, zero ENV-BLOCKED).
5. Print the final evidence report (<= 25 lines): PR URL + merge status, before/after byte sizes of `index.html`, `data/learning-tools.js`, `data/app-core.js`, `data/studio.js`, `data.html`, R6 grep counts (`0`), and the G1..G9 gate table.

---

## 3. HELPER FILES

### 3.1 `.work/v61/peek.cjs` — windowed reader for minified files
~~~js
#!/usr/bin/env node
'use strict';
// Usage: node .work/v61/peek.cjs <file> <needle> [before=200] [after=800] [nth=1]
var fs = require('fs');
var file = process.argv[2], needle = process.argv[3];
var before = +(process.argv[4] || 200), after = +(process.argv[5] || 800), nth = +(process.argv[6] || 1);
var src = fs.readFileSync(file, 'utf8');
var idx = -1, hit = 0;
while (true) { idx = src.indexOf(needle, idx + 1); if (idx < 0) break; if (++hit === nth) break; }
if (idx < 0) { console.error('NOT FOUND: ' + needle + ' (occurrences: ' + (hit - 1) + ')'); process.exit(1); }
console.log('[' + file + ' @' + idx + ' occurrence ' + hit + ' / total ' + (src.split(needle).length - 1) + ']');
console.log(src.slice(Math.max(0, idx - before), idx + needle.length + after));
~~~

### 3.2 `.work/v61/patchlib.cjs` — verified single-occurrence patcher & range deleter
~~~js
#!/usr/bin/env node
'use strict';
// Usage as CLI: node .work/v61/patchlib.cjs <file> <exact-old> <exact-new> [expected-count=1]
// Usage as module: var patchlib = require('./patchlib.cjs'); patchlib.rep(file, oldS, newS, want);
var fs = require('fs');
function rep(file, oldS, newS, want) {
  want = want == null ? 1 : +want;
  var src = fs.readFileSync(file, 'utf8');
  var parts = src.split(oldS);
  var found = parts.length - 1;
  if (found !== want) {
    throw new Error('ABORT [' + file + ']: ' + JSON.stringify(oldS.slice(0, 60)) + ' found ' + found + 'x, expected ' + want);
  }
  var out = parts.join(newS);
  fs.writeFileSync(file + '.tmp', out);
  fs.renameSync(file + '.tmp', file);
  console.log('OK: replaced ' + found + ' occurrence(s) in ' + file);
  return found;
}
function killRange(file, startNeedle, endNeedle, want) {
  want = want == null ? 1 : +want;
  var src = fs.readFileSync(file, 'utf8');
  var done = 0, out = [], cur = 0;
  while (done < want) {
    var s = src.indexOf(startNeedle, cur);
    if (s < 0) break;
    var e = src.indexOf(endNeedle, s + startNeedle.length);
    if (e < 0) throw new Error('ABORT [' + file + ']: endNeedle not found after startNeedle');
    out.push(src.slice(cur, s));
    cur = e + endNeedle.length;
    done++;
  }
  if (done !== want) throw new Error('ABORT [' + file + ']: expected ' + want + ' range(s), killed ' + done);
  out.push(src.slice(cur));
  var res = out.join('');
  fs.writeFileSync(file + '.tmp', res);
  fs.renameSync(file + '.tmp', file);
  console.log('OK: killed ' + done + ' range(s) in ' + file);
  return done;
}
module.exports = { rep: rep, killRange: killRange };
if (require.main === module && process.argv[2]) {
  rep(process.argv[2], process.argv[3], process.argv[4], +(process.argv[5] || 1));
}
~~~

### 3.3 `.work/v61/strgen.cjs` — ES5-safe literal generator (Sinhala/emoji -> \uXXXX)
~~~js
#!/usr/bin/env node
'use strict';
// Usage: node .work/v61/strgen.cjs "සිංහල text 🦢" -> prints ASCII-only ES5 string literal
function toAsciiLiteral(input) {
  var out = '';
  for (var i = 0; i < input.length; i++) {
    var c = input.charCodeAt(i);
    out += (c > 126 || c < 32) ? '\\u' + ('000' + c.toString(16)).slice(-4).toUpperCase() : input[i];
  }
  return "'" + out.replace(/'/g, "\\'") + "'";
}
module.exports = { toAsciiLiteral: toAsciiLiteral };
if (require.main === module) {
  console.log(toAsciiLiteral(process.argv.slice(2).join(' ')));
}
~~~

BEGIN NOW with P0.
