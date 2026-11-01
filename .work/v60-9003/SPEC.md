# TASK — dictationb1/dictationb1.github.io: v59/v60-partial -> v60 (9.0.0.3) Next-Gen UI Complete Replacement
Work autonomously through phases P0..P6; each phase ends with verify + commit + push to branch `feat/v60-nextgen-9-0-0-3` so a new session can resume from the repo alone.
Ask no questions mid-run: choose the safest deterministic option that preserves all existing IDs and report it in P6.

STOP only on the listed STOP conditions in P0 (wrong repository or corrupt baseline) or P6 (after PR creation if any gate is ENV-BLOCKED or FAIL).

## 0. WORKING RULES
W1 SAVE THE SPEC. First action (skip if `.work/v60-9003/SPEC.md` exists): with your file-write tool (not `echo`), save this entire message, unabridged, as `.work/v60-9003/SPEC.md`. If your context is compacted or you are unsure of a detail, re-read that section from the file instead of guessing.
W2 RESUME. `git fetch origin --prune; git branch -r`. If `origin/feat/v60-nextgen-9-0-0-3` exists: check it out and read `.work/v60-9003/PROGRESS.md`; continue at the first unfinished phase. If the branch exists but has no PROGRESS.md, all work phases are finished: go straight to step 2 of the release phase (P6). If the branch does not exist: `git checkout -b feat/v60-nextgen-9-0-0-3 origin/main`. (If pushing that branch name is rejected, keep the session's own branch and use it everywhere instead.)
W3 PROTECT YOUR CONTEXT. Huge or minified files: `index.html`, `data/learning-tools.js`, `data/studio.js`, `data.html`, `data/index.html`, `data/words.js`. NEVER `cat`, `view`, `head`, `tail`, `sed -n`, plain `grep`, `git diff` or `git show` on them. Use only `wc -c`, `git diff --stat`, and `node .work/v60-9003/peek.cjs <file> "<needle>" [radius] [maxHits]`. Same rule for any file > 50 KB. Send command output to `/tmp/*.log` and read only `tail -n 40` or `grep -n -i -E "fail|error|assert"`. Put independent shell steps into ONE tool call.
W4 EDIT HUGE FILES ONLY THROUGH A PATCH-SCRIPT FILE built on `.work/v60-9003/patchlib.cjs`. Forbidden on them: `sed`, `perl -pi`, `awk` redirects, edit/str_replace tools, `node -e` one-liners, whole-file rewrites. Write every script with your file-write tool or a QUOTED heredoc (`cat > f <<'EOF'`); never put JavaScript inside a double-quoted shell string; write non-ASCII characters inside scripts as `\uXXXX` escapes.
W5 ANCHORS. Strings marked VERIFIED were checked against the repo (count given). Strings marked UNVERIFIED are hints: if `rep()` finds a different count, `peek` a short stem, adapt the anchor ONCE, re-run. Max 2 attempts per anchor.
W6 SAFETY NET. In P0 record baseline sizes. After every phase run the size check and `node tests/check.cjs && node --test tests/upgrade.test.cjs` (must pass from P1 on), then `git add -A && git commit -m "v60-9003 P<n>: <what>" && git push -u origin HEAD`, then tick the phase in `.work/v60-9003/PROGRESS.md`. If `index.html` grows by more than 15 KB over baseline, or `node tests/check.cjs && node --test tests/upgrade.test.cjs` fails twice, run `git checkout -- <file>` and redo the phase with the patch script.
W7 NO ENDLESS LOOPS. Max 3 fix attempts per failing check. A gate failing for ENVIRONMENT reasons (no browser binary, blocked download or network, port in use) is ENV-BLOCKED: retry once, record it in PROGRESS.md, move on, and do NOT change product code to appease it. Never weaken or delete a test except the assertions the phases tell you to change.
W8 TIME LIMITS. Run every gate as `timeout 120 <cmd> > /tmp/<name>.log 2>&1; echo "exit=$?"`. If a command is moved to the background or hits its timeout, poll its log; do not start it again.
W9 CALL BUDGET. Each phase states a tool-call budget: batch commands to stay inside it. If you reach 1.5x a phase's budget, stop that phase, commit what works, write `NEXT:` plus what is left into PROGRESS.md, push, and end with the final report (a new session resumes from there).
W10 ONE PR. This chat session can create only ONE pull request. Create it once, in the last phase (P6); before creating, check for an existing open PR for the branch and reuse it.

## 1. GLOBAL RULES (R1..R10)
R1 ES5-STRICT. Every shipped browser script (`index.html`, `data.html`, `data/index.html`, `sw.js`, `data/learning-tools.js`, `data/studio.js`, `data/data-meter.js`, `data/words.js`) MUST parse under `new Function(src)` and Acorn `ecmaVersion: 5` (`var` and `function(){}` only; zero `let`, `const`, `=>`, template literals, `class`, `async`, `await`, `for..of`, destructuring, spread, or default parameters). All non-ASCII characters (Sinhala, emojis, symbols) inside JS patch scripts MUST be written as `\uXXXX` escapes.
R2 BYTE BUDGETS. `index.html` <= 598,000 bytes (hard ceiling in `tests/check.cjs` is 600,000 bytes; baseline is 450,000..520,000 bytes). `data.html` and `data/index.html` <= 60,000 bytes each and MUST be byte-for-byte identical (`cmp -s data.html data/index.html`). No static `<link>` tags for fonts or stylesheets in `index.html`.
R3 VERSION STAMPS VS PROTECTED IDENTIFIERS.
  - Version stamps to set: `ver` = `60`, `APP_VERSION` = `"9.0.0.3"`, `version` = `"9.0.0.3"`, `appVersion` = `"9.0.0.3"`, `schema` = `60`, `settingsRev` = `60`, `SW_VERSION` = `'sdp-v60-9.0.0.3'`, script cache-bust query `?v=9.0.0.3`.
  - Protected identifiers that MUST NEVER be renamed (referenced by `tests/check.cjs` and core engine): `#sdpV57Css`, `#sdpV58Css`, `#sdpLearnCss`, `#sdpDataSheetCss`, `#v58Dock`, `v58-keyboard`, `#v58ContextNextBtn`, `#v58VoiceBadge`, `v58-sig-pill`, `v59-dict-card`, `v59-ipa`, `v59-pos`, `sdp_onboard_v58`, `sdp_sr_v2`, `sdp_gam_v2`, `sdp-youdao-v1`, `SDP_ENC_V2`.
R4 PRESERVED DOM IDS. Never remove these IDs from the document (when retiring a legacy visual element, move it into `#sdpLegacyKeeper` with `display:none!important` or inside collapsed `<details id="sdpAppearanceAccordion">` so `document.getElementById` never returns `null`): `#app`, `.topbar`, `#brandName`, `#brandSub`, `#chipNet`, `#btnLock`, `#btnLiveVideo`, `#btnLang`, `#btnGuideTop`, `#btnPerf`, `#btnTheme`, `#btnRefresh`, `#topDataBadge`, `#btnAdmin`, `#tabbar`, `#tab-home`, `#tab-dict`, `#tab-comm`, `#tab-set`, `#screen-home`, `#homeAnn`, `#homeHero`, `#homeKicker`, `#homeTitle`, `#homeSub`, `#homeMeta`, `#homeResume`, `#btnStart`, `#btnStartText`, `#btnGuide`, `#segMode`, `#homeStats`, `#homeSessions`, `#screen-dict`, `#dictSearch`, `#dictTabs`, `#dictList`, `#screen-comm`, `#btnCompose`, `#screen-set`, `#setBody`, `#rateRange`, `#volRange`, `#repeatsSelect`, `#readSentenceToggle`, `#writeSecsRange`, `#bitrateSelect`, `#layers`, `#sheets`, `#modals`, `#toasts`, `#credit`, `#dataSheet`, `#plCount`, `#plBars`, `#plFill`, `#plStatus`, `#plWord`, `#plHint`, `#plRing`, `#plPlay`, `#cdFg`, `#cdNum`, `#ansInput`.
R5 RENDER-HOOK REPLACEMENT RULE.
  - In `index.html`, `UI.setTab(name)` invokes `Screens.home()`, `Screens.dict()`, `Screens.comm()`, or `Screens.settings()` on EVERY tab switch, and `Cloud` sync invokes `Screens.home()` after network responses.
  - `Screens.settings()` runs `U.$("#setBody").textContent = ""` and rebuilds legacy wallpaper/voice/dictation cards on every call. `Screens.dict()` runs `U.$("#dictList").textContent = ""` on every call. `Eng.openPlayer()` builds `.layer.player` inside `#layers` on every `Eng.start()`.
  - Therefore, one-shot DOM mutations at boot are wiped out on tab click or sync. You MUST wrap `Screens.home`, `Screens.dict`, `Screens.settings`, `Eng.openPlayer`, `Eng.paint`, and `Eng.paintCountdown` so that EVERY call renders the Next-Gen v60 layout and hides legacy clutter.
R6 CASCADE SUPREMACY & LEGACY NEUTRALISATION.
  - `neutraliseLegacyStyles()` in `data/learning-tools.js` MUST disable `#sdpV57Css` and `#sdpV58Css` (`el.disabled = true; el.textContent = "/* v60 neutralised */";` while keeping both `<style>` elements in `document.head` so `check.cjs` marker checks pass) and override any conflicting `.v58-workspace`, `.v58-rail`, `.topbar`, and `#tabbar` rules from `#sdpLearnCss` and `index.html`.
  - `#sdpNextGenCss` MUST remain the last `<style>` child of `document.head` via a `MutationObserver` on `document.head`.
R7 DESIGN SYSTEM TOKENS (`#sdpNextGenCss`).
  - Canvas: `#09090B` (`--bg-canvas`); Card: `#18181B` (`--bg-card`, `rgb(24, 24, 27)`); Elevated: `#222226` / `#27272A` (`--bg-elevated`); Border: `rgba(255,255,255,0.08)` (`--border-subtle`); Primary text: `#FAFAFA`; Muted text: `#A1A1AA` / `#71717A`; Accent: `#38BDF8` (`--accent-primary`, ink `#062530`); Listen: `#38BDF8`; Write: `#FBBF24`; Review/OK: `#4ADE80`; Danger: `#F87171`; Gold: `#F5C842`.
  - Zero `backdrop-filter` anywhere (`*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`).
  - Fonts: Latin `'Inter', system-ui, -apple-system, sans-serif` with `font-variant-numeric: tabular-nums` on numbers; Sinhala `'Noto Sans Sinhala'` scoped to `[lang="si"]` and `.si-text` (`line-height: 1.65`).
R8 SELF-HEALING SERVICE WORKER & CACHE EVICTION.
  - `index.html` `<head>` MUST begin with an inline ES5 script (`#sdpSwBoot`) that checks `localStorage.getItem("sdp_sw_ver") !== "9.0.0.3"`. On mismatch, it writes `"9.0.0.3"`, deletes all `window.caches` keys not containing `"9.0.0.3"` (except `"sdp-youdao-v1"`), calls `reg.update()` on all Service Worker registrations, and attaches a one-time `controllerchange` listener that calls `location.reload()`.
  - `sw.js` `install` MUST cache `SHELL` entries individually with `.catch(function(){return null;})` per entry (never raw `cache.addAll(SHELL)`) and call `self.skipWaiting()`. `sw.js` `fetch` MUST use Network-First (`fetch(req, {cache:"no-cache"})` with cache fallback) for navigation (`index.html`, `/`, `/data`) and `.js`/`.json` requests.
R9 SECURITY & STUDIO INVARIANTS. Zero hardcoded PINs, ElevenLabs keys, or GitHub tokens in any file. `SDP_ENC_V2` uses PBKDF2-SHA256 with `iterations: 250000` (in `data/studio.js` and `index.html`). Default ElevenLabs model in `data/studio.js` and `data/elevenlabs-audio.json` is `"eleven_flash_v2_5"`, default voice is Alice (`"Xb7hH8MSUJpSbSDYk0k2"`).
R10 GATES & CHEAP CHECK.
  - Cheap check (`<CHEAP_CHECK>`): `node tests/check.cjs && node --test tests/upgrade.test.cjs` (~4s, no browser, no network).
  - Full gates (all run with `timeout 120 <cmd> > /tmp/<name>.log 2>&1; echo "exit=$?"`):
    - G1: `node tests/check.cjs` (static syntax/byte/marker/JSDOM check, no browser, ~3s)
    - G2: `node --test tests/upgrade.test.cjs` (unit/mock suite, no browser, ~3s)
    - G3: `node tests/phase1.cjs` (engine/crypto/meter suite, no browser, ~5s)
    - G4: `node tests/server.cjs` (Apps Script mock suite, no browser, ~3s)
    - G5: `node tests/browser.cjs` (Playwright browser gate, requires Chromium, ~30s)
    - G6: `node tests/upgrade-browser.cjs` (Playwright v60 visual/compositor gate, requires Chromium, ~30s)
    - G7: `node tests/e2e.cjs` (Playwright E2E suite, requires Chromium, ~45s)
    - G8: `node tests/live-lab.cjs` (Playwright studio/vault suite, requires Chromium, ~35s)
    - G9: `node tests/audit-v42.cjs` (Playwright regression suite, requires Chromium, ~30s)

## 2. PHASES

### P0 — PREFLIGHT (budget <= 8 calls)
1. Do W1 and W2. Note `git log -1 --oneline` (expected: `ab2303b` or `548c641`; if different, continue and report it).
2. Baseline: `wc -c index.html data.html data/index.html data/learning-tools.js data/studio.js sw.js`; `index.html` must be within `450000..598000` bytes and `data.html` within `40000..60000` bytes, else STOP and report (wrong baseline). Record the sizes in `.work/v60-9003/PROGRESS.md`.
3. `node -v`. Install dependencies with `npm ci --prefix tests` only if `tests/node_modules` is missing. Run `timeout 120 sh -c 'node tests/check.cjs && node --test tests/upgrade.test.cjs' > /tmp/p0-cheap.log 2>&1; echo "exit=$?"` on the untouched baseline and record PASS/FAIL (do not fix unrelated pre-existing failures in P0).
4. ONE probe call: browser binaries (`ls ~/.cache/ms-playwright 2>/dev/null; command -v chromium chromium-browser google-chrome 2>/dev/null`), `gh api repos/dictationb1/dictationb1.github.io --jq .full_name`. Record the result in PROGRESS.md and pre-mark browser gates G5..G9 as ENV-BLOCKED only if no Chromium binary is present.
5. Create `.work/v60-9003/peek.cjs`, `.work/v60-9003/patchlib.cjs`, `.work/v60-9003/strgen.cjs` (Section 3) and `.work/v60-9003/PROGRESS.md` (checklist P0..P6 + gate table G1..G9).
6. Commit `"v60-9003 P0: preflight and helpers"` and push.

### P1 — VERSION STAMPS (9.0.0.3), FAULT-TOLERANT SW & CACHE-EVICTION BOOT (budget <= 10 calls)
Goal: Update all version stamps to `9.0.0.3` (`ver: 60`), make `sw.js` fault-tolerant and Network-First for HTML/JS/JSON, inject `#sdpSwBoot` and `?v=9.0.0.3` script URLs into `index.html`, and update version assertions in `tests/check.cjs`, `tests/upgrade.test.cjs`, and `tests/server.cjs`.
Edits:
1. JSON stamps (`version.json`, `data/version.json`, `data/config.json`, `data/session.json`, `data/elevenlabs-audio.json`):
   - Write and run `.work/v60-9003/p1-json.cjs` to parse each file, set `ver = 60`, `version = "9.0.0.3"`, `appVersion = "9.0.0.3"`, `schema = 60`, `settingsRev = 60`; in `data/config.json` set `defaults.perf = "auto"` and `defaults.wallpaperVideo = false`; in `data/elevenlabs-audio.json` set `modelId = "eleven_flash_v2_5"`.
2. `sw.js`:
   - Write and run `.work/v60-9003/p1-sw.cjs` (using `patchlib.cjs` or clean ES5 rewrite validated by `node --check sw.js`):
     - Set `var VERSION = 'sdp-v60-9.0.0.3';`, `var APP_VERSION = '9.0.0.3';`, `var MEDIA_MAX_ENTRIES = 160;`.
     - Ensure `SHELL` array contains `'./assets/audio/guide-si-1.mp3'` and `'./data/learning-tools.js'` and `'./data/studio.js'`.
     - In `install`: cache each `SHELL` entry individually with `Promise.all(SHELL.map(function (u) { return fetch(u, { cache: 'reload' }).then(function (r) { return r && r.ok ? cache.put(u, r) : null; })['catch'](function () { return null; }); }))` then `self.skipWaiting()`.
     - In `activate`: delete all caches where `k.indexOf('9.0.0.3') === -1 && k !== 'sdp-youdao-v1'`, prune media cache to `MEDIA_MAX_ENTRIES`, and call `self.clients.claim()`.
     - In `fetch`: for `e.request.mode === 'navigate'` or URLs matching `/\.(html|js|json)(\?|$)/`, run Network-First (`fetch(e.request, { cache: 'no-cache' })` updating cache on `200`, falling back to `caches.match(e.request)` or `caches.match('./index.html')`).
3. `index.html`, `data.html`, `data/index.html`:
   - Use `node .work/v60-9003/peek.cjs index.html "APP_VERSION" 80 3` and `node .work/v60-9003/peek.cjs index.html "learning-tools.js" 120 3` to inspect the exact anchors.
   - Write and run `.work/v60-9003/p1-html.cjs` using `patchlib.cjs`:
     - In `index.html`:
       - Replace `APP_VERSION="9.0.0.2"` (UNVERIFIED — peek first, count 1) with `APP_VERSION="9.0.0.3"`.
       - Replace script query strings on `data/studio.js` and `data/learning-tools.js` (UNVERIFIED — peek first, count 1 each) so both end with `?v=9.0.0.3" defer></script>`.
       - Ensure `<body` has `class="sdp-nextgen"` without `wallpaper-on` (UNVERIFIED — peek `<body`, count 1).
       - Inject or update `<script id="sdpSwBoot">...</script>` right after `<head>` (count 1) implementing R8.
       - Save `index.html` with `p.save(598000)`.
     - In `data.html`: update version display strings to `9.0.0.3`, save with `p.save(60000)`, and copy `data.html` to `data/index.html`.
4. `tests/check.cjs`, `tests/upgrade.test.cjs`, `tests/server.cjs`:
   - Use `peek.cjs` to locate version assertions (`9.0.0.2` / `9.0.0.1` / `9.0.0` / `v60`) in those 3 test files and update them to `9.0.0.3` / `sdp-v60-9.0.0.3`.
5. Cheap check: `timeout 120 sh -c 'node tests/check.cjs && node --test tests/upgrade.test.cjs' > /tmp/p1-cheap.log 2>&1; echo "exit=$?"`.
6. Commit `"v60-9003 P1: version 9.0.0.3, fault-tolerant SW, and head cache eviction"` and push.

### P2 — `index.html` TOP-GAP PURGE & `data/studio.js` FLASH/VAULT HARDENING (budget <= 10 calls)
Goal: Remove any remaining dead top-gap CSS rules or forced wallpaper classes in `index.html`, and verify `data/studio.js` enforces `eleven_flash_v2_5` default, Alice voice default, and `SDP_ENC_V2` at `250000` PBKDF2 iterations.
Edits:
1. Use `peek.cjs` on `index.html` for `140px`, `154px`, `top:calc(68px`, `iterations:`, and `createMediaElementSource`.
2. Write and run `.work/v60-9003/p2-core.cjs` using `patchlib.cjs`:
   - In `index.html`:
     - If `padding-top:calc(140px` or `.topbar.glass{top:calc(68px` exists (UNVERIFIED — adapt once), replace with `padding-top:calc(66px` and `.topbar.glass{top:0!important`.
     - If `iterations:15e4` or `iterations:150000` exists (UNVERIFIED — adapt once), replace with `iterations:250000`.
     - Save `index.html` with `p.save(598000)`.
   - In `data/studio.js`:
     - Ensure default model is `"eleven_flash_v2_5"`, default voice is `"Xb7hH8MSUJpSbSDYk0k2"`, PBKDF2 `iterations` is `250000`, and `saveVault` / `getVault` / `SDP_ENC_V2:` markers are present.
     - Save `data/studio.js` with `p.save(220000)`.
3. Cheap check: `timeout 120 sh -c 'node tests/check.cjs && node --test tests/upgrade.test.cjs && node tests/phase1.cjs && node tests/server.cjs' > /tmp/p2-check.log 2>&1; echo "exit=$?"`.
4. Commit `"v60-9003 P2: index.html top-gap cleanup and studio flash/vault hardening"` and push.

### P3 — `data/learning-tools.js` PART 1: CASCADE SUPREMACY, GLOBAL CHROME & HOME SCREEN REBUILD (budget <= 12 calls)
Goal: Update `data/learning-tools.js` so that `#sdpV57Css` and `#sdpV58Css` are neutralised, `#sdpNextGenCss` enforces the Zinc-950/Sky-400 design system with zero blur and hides all legacy Home/Topbar clutter, and `Screens.home` is wrapped so every Home render produces ONLY the Next-Gen Home UI (Mockups 6.1, 6.6, 6.7).
Edits:
1. Use `peek.cjs` on `data/learning-tools.js` to inspect how the v60 module is currently structured at the bottom of `data/learning-tools.js`.
2. Write and run `.work/v60-9003/p3-home-chrome.cjs` using `patchlib.cjs` and `strgen.cjs` (strict ES5, all non-ASCII as `\uXXXX`):
   - **`neutraliseLegacyStyles()`**:
     - Keep `<style id="sdpV57Css">` and `<style id="sdpV58Css">` in `document.head`, set `.disabled = true` and `.textContent = "/* v60 neutralised */"`.
     - Observe `document.head` via `MutationObserver` so if `#sdpV57Css` or `#sdpV58Css` is modified or re-added, it is immediately disabled and `#sdpNextGenCss` is kept as `document.head.lastElementChild`.
     - Remove `wallpaper-on` from `document.body.className` unless `localStorage.getItem("sdp_wp_explicit_v60") === "1"`.
   - **`#sdpNextGenCss` Strict Clutter-Hiding & Layout Rules**:
     - Hide all legacy Home and Topbar clutter (`display: none !important; visibility: hidden !important; pointer-events: none !important;`):
       - In `.topbar`: hide `#topDataBadge`, `#btnLiveVideo`, `#chipNet`, `#btnLang`, `#btnGuideTop`, `#btnPerf`, `#btnTheme`, `#btnRefresh`, `#btnAdmin`, `#btnLock`, `.v58-more-btn`, `#v58MoreBtn`, `.v58-overflow-pop` (move those legacy button nodes into `<div id="sdpLegacyKeeper" hidden style="display:none!important"></div>` appended to `document.body` so their IDs still exist in DOM).
       - In `#screen-home`: hide `#v58VoiceBadge`, `#homeMeta`, `#segMode`, `#homeStats`, `.v58-bento`, `.v58-rail`, `.v58-kbd-hud`, `#credit.v58-sig-pill`, `.sdp-retry-toast`, and on `< 1024px` hide `#homeSessions`.
     - Enforce `.topbar`: `position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; height: 54px !important; margin: 0 !important; padding: 0 14px !important; background: #09090B !important; border: none !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; border-radius: 0 !important; transform: none !important; z-index: 80 !important; display: flex !important; align-items: center !important; justify-content: space-between !important;`.
     - Enforce `#app`: `padding-top: 66px !important; padding-bottom: 96px !important; max-width: 520px; margin: 0 auto;`.
     - Enforce `#tabbar` (`< 1024px`): `position: fixed !important; left: 12px !important; right: 12px !important; bottom: 10px !important; height: 62px !important; padding: 5px !important; background: #121215 !important; border: 1px solid rgba(255,255,255,0.10) !important; border-radius: 20px !important; display: grid !important; grid-template-columns: repeat(5, 1fr) !important; gap: 4px !important; transform: none !important; z-index: 75 !important;`.
     - Enforce Desktop `@media (min-width: 1024px)`: `#tabbar { display: none !important; }`, `#sdpDesktopRail { display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; bottom: 0 !important; width: 232px !important; background: #0D0D10 !important; border-right: 1px solid rgba(255,255,255,0.08) !important; z-index: 85 !important; flex-direction: column !important; justify-content: space-between !important; padding: 16px 12px !important; }`, `.topbar { left: 232px !important; width: calc(100% - 232px) !important; }`, `#app { margin-left: 232px !important; max-width: calc(100vw - 232px) !important; padding: 72px 28px 40px !important; display: block !important; }`.
   - **Global Chrome Builders (`mountChrome()`)**:
     - `.topbar` left (`#sdpBrandCluster`): `32x32px` cyan swan badge (`#0C2D3E`) + `Smart Dictation` (`#brandName`) + `<span id="sdpVerPill">v60</span>` + subtitle `CCBE Galle Branch` (`#brandSub`).
     - `.topbar` right (`#sdpTopActions`): ONLY 3 buttons: `#sdpTopVoiceBtn` (`34x34px` cyan mic button), `#sdpTopLangPill` (`EN | \u0DC3\u0DD2\u0D82\u0DC4\u0DBD` pill), `#btnOpenSettingsTop` (`34x34px` settings sliders button -> `UI.setTab('set')`).
     - `#tabbar`: 5 buttons (`Home` `#tab-home`, `Words` `#tab-dict`, `Dictate` `#tab-dictate`, `Practice` `#tab-prac`, `Settings` `#tab-set`); move `#tab-comm` into `#sdpLegacyKeeper` while keeping `UI.setTab('comm')` functional.
     - `#sdpDesktopRail`: brand header + 5 vertical nav buttons + `#creditDockedDesktop` (`\uD83E\uDDA2 Crafted by Hansana`).
   - **Wrapped `Screens.home` (`renderNextGenHome()`)**:
     - Wrap `Screens.home` so every execution of `Screens.home()` immediately runs `renderNextGenHome()`:
       - `#sdpHomeGreeting` above `#homeHero`: left greeting (`Good evening, Student` / SI equivalent), right session label (`Tue \u00b7 Session 8`).
       - `#homeHero` (`background: #18181B !important; background-image: none !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 16px !important; padding: 16px !important;`):
         - `#homeKicker`: `\u25CF SESSION 8 \u00b7 29 OCT 2026` (`#38BDF8`)
         - `#homeTitle`: `Personal Feelings, Opinions & Experiences`
         - `#homeSub`: forced to `30 adjectives \u00b7 UK English \u00b7 \uD83C\uDDEC\uD83C\uDDE7 Alice studio voice` (overwriting the long legacy lecturer paragraph).
         - `#sdpHeroConfigChips`: 4 live pills (`\u270D\uFE0F Paper mode` or `\u2328\uFE0F Typing mode`, `\uD83D\uDD53 0.90\u00d7`, `\u00d72 repeats`, `8s write`); clicking any pill calls `UI.setTab('set')`.
         - `#btnStart`: full-width `46px` `#38BDF8` CTA with `#btnStartText` (`\u25B6 Start dictation`) and right span `#sdpBtnStartEst` (`\u2248 6 min`).
         - `#btnHowItWorks` (and `#btnGuide`): full-width `40px` `#222226` ghost button below `#btnStart` (`How it works \u00b7 60s guide`).
       - `#sdpHomeStatsRow` below `#homeHero`: 3 cards (`#sdpStatStreak` `5 days`, `#sdpStatMastered` `14 / 30` in `#4ADE80`, `#sdpStatWeak` `3` in `#FBBF24`).
       - `#sdpQuickPracticeGrid`: `QUICK PRACTICE` heading + `2x2` grid of 4 horizontal-icon cards (`Flashcards`, `Quiz`, `Sentence gap`, `Weak words` with amber badge).
       - `#creditDocked` (`\uD83E\uDDA2 Crafted by Hansana`) above `#tabbar`, `#creditPill` (`\uD83E\uDDA2 CREDITS GOES TO Hansana` gold shimmer for 3800ms, `pointer-events: none`), and `#microToastLoad` (`\u26A1 0.34 MB used on load` bottom-left for 3500ms, `pointer-events: none`).
3. Cheap check: `timeout 120 sh -c 'node --check data/learning-tools.js && node tests/check.cjs && node --test tests/upgrade.test.cjs' > /tmp/p3-cheap.log 2>&1; echo "exit=$?"`.
4. Commit `"v60-9003 P3: cascade supremacy, global chrome, and wrapped Screens.home"` and push.

### P4 — `data/learning-tools.js` PART 2: WRAPPED COCKPIT, SETTINGS, WORDS EXPLORER & SINHALA I18N (budget <= 12 calls)
Goal: Wrap `Eng.openPlayer` / `Eng.paint` / `Eng.paintCountdown`, `Screens.settings`, `Screens.dict`, and `window.SDP_applyLang` so that Dictation Cockpit, Settings, and Words Explorer permanently replace legacy v58/v59 UI on every render.
Edits:
1. Write and run `.work/v60-9003/p4-screens.cjs` using `patchlib.cjs` and `strgen.cjs` (strict ES5, `\uXXXX` escapes):
   - **Wrapped `Eng.openPlayer`, `Eng.paint`, and `Eng.paintCountdown` (Mockups 6.2 & 6.8)**:
     - Inside `.layer.player`:
       - Hide `.lens` (`display: none !important`).
       - Style `.wordcard` as `#sdpCockpitCard` (`background: #18181B !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 16px !important; padding: 16px !important; position: relative !important; overflow: hidden !important;`):
         - `#sdpEdgeBar` (`4px` top-edge bar) + `#sdpEdgeBarFill` (sky `#38BDF8` in speaking/listen, amber `#FBBF24` in waiting/write, emerald `#4ADE80` in reveal).
         - `#sdpCockpitHeaderRow`: left `#sdpCockpitWordOf` (`Word 12 of 30`), center `#plStatus` phase chip (`\u25CF Writing time`), right `#sdpTimerPill` (`34px` pill containing `#cdNum` formatted as `05.0s` tabular-nums + `24x24px` SVG `#cdFg`).
         - `#sdpCockpitStage`: `DICTATION N` kicker + `#sdpLetterSlots` (letter slot boxes in paper mode or `#ansInput` in typing mode) + caption `Write on paper \u00b7 the word was read twice`.
         - `#sdpCockpitDock`: 4-column helper dock (`Repeat`, `Slower`, `Sentence`, `Spell it` wired to `Eng.repeatWord()`, `Eng.slower()`, `Eng.repeatSentence()`, `Eng.spellWord()`).
         - `#sdpCockpitFoot`: left `\uD83C\uDDEC\uD83C\uDDE7 Alice \u00b7 studio voice \u00b7 0.90\u00d7`, right `[Pause]` (`Eng.playPause()`) and `[Skip]` (`Eng.next()`) buttons.
       - Below `#sdpCockpitCard`: `#sdpCockpitCounters` (`CORRECT`, `MISSED`, `STREAK`) + `#sdpWordMapCard` (`10x3` grid of 30 word numbers `1..30`).
   - **Wrapped `Screens.settings` (Mockups 6.3 & 6.4)**:
     - Every time `Screens.settings()` runs (including after `U.$("#setBody").textContent = ""`):
       - Mount/update `#sdpNextGenSettings` as the **first child of `#screen-set`** (`scrollTop === 0`).
       - Render `PRIORITY 1 \u00b7 DICTATION & LEARNING` card (`#18181B`) with the 6 wired controls:
         1. `#sdpSegMode` (`[\uD83D\uDCDD Paper | \u2328\uFE0F Typing]`) -> updates `DB.data.settings.mode` and `DB.save()`.
         2. `#sdpSegSpeed` (`[0.75\u00d7 Slow | 0.90\u00d7 Clear | 1.0\u00d7 Normal]`) -> updates `DB.data.settings.rate` and `#rateRange`.
         3. `#sdpSegRepeats` (`[1\u00d7 | 2\u00d7 | 3\u00d7]`) -> updates `DB.data.settings.repeats` and `#repeatsSelect`.
         4. `#sdpRangeWait` (`min="3" max="15" step="1"`, live `8 s` badge) -> sets `DB.data.settings.writeMode = "fixed"`, `DB.data.settings.writeFixed = Number(val)`, and updates `#writeSecsRange`.
         5. `#sdpToggleAutoSentence` -> updates `DB.data.settings.readSentence` and `#readSentenceToggle`.
         6. `#sdpSegLang` (`[English | \u0DC3\u0DD2\u0D82\u0DC4\u0DBD]`) -> calls `window.SDP_applyLang`.
       - Render `PRIORITY 2 \u00b7 VOICE & AUDIO CHECK` card (`\uD83C\uDDEC\uD83C\uDDE7 Alice \u00b7 UK Studio Voice` + `[Test voice]` button + volume slider).
       - Render `PRIORITY 3 \u00B7 APPEARANCE (OPTIONAL)` as a collapsed `<details id="sdpAppearanceAccordion">` (`open = false`) at the bottom of `#sdpNextGenSettings`, and move `#setBody` **inside** `<details id="sdpAppearanceAccordion">` so `#setBody`'s legacy wallpaper/voice/dictation cards are hidden inside the collapsed accordion while keeping `#rateRange, #volRange, #repeatsSelect, #readSentenceToggle, #writeSecsRange, #bitrateSelect` in the DOM!
   - **Wrapped `Screens.dict` (Mockup 6.5)**:
     - Hide `#dictTabs` and any duplicate v58/v59 Weak Words bars in `#screen-dict`.
     - Mount `#sdpWordFilterRow` (`All`, `Weak`, `Mastered`, `A\u2013Z`) below `#dictSearch`.
     - Every time `Screens.dict()` runs, render full-field `.sdp-word-card.wordcard.v59-dict-card` cards in `#dictList`: `28x28px` number badge (`1..30`), bold headword (`w.w`), Sky-400 IPA (`.v59-ipa`), italic POS (`.v59-pos`), full English definition (`w.m`), full example sentence (`w.s` with target word bolded), `.sdp-si-pill` (`\u0DC3\u0DD2\u0D82\u0DC4\u0DBD \u00B7 ` + `w.si`), and right-side stacked `34x34px` `[Play]` and `[Slow]` buttons.
   - **Corrected Sinhala Dictionary (`SDP_SI_DICT` & `window.SDP_applyLang`) + `SDPOfflineDB` (`sdp_offline_v60`)**:
     - Ensure `window.SDP_applyLang(lang)` updates all Next-Gen labels in place and enforces strict EN/SI purity.
2. Cheap check: `timeout 120 sh -c 'node --check data/learning-tools.js && node tests/check.cjs && node --test tests/upgrade.test.cjs' > /tmp/p4-cheap.log 2>&1; echo "exit=$?"`.
3. Commit `"v60-9003 P4: wrapped cockpit, priority-1 settings, words explorer, and Sinhala i18n"` and push.

### P5 — LOCKSTEP TEST GATES & VISUAL ABSENCE ASSERTIONS (budget <= 12 calls)
Goal: Update all test gates (`tests/check.cjs`, `tests/upgrade.test.cjs`, `tests/phase1.cjs`, `tests/server.cjs`, `tests/browser.cjs`, `tests/upgrade-browser.cjs`, `tests/e2e.cjs`, `tests/live-lab.cjs`, `tests/audit-v42.cjs`) to verify the v60 UI and assert that legacy v58/v59 clutter is hidden, then run all 9 gates.
Edits:
1. In `tests/check.cjs`:
   - Verify JSDOM execution calls `Screens.home()`, `Screens.settings()`, and `Screens.dict()` and asserts:
     - `#sdpNextGenSettings` is mounted before `#setBody`, and `#setBody.closest("details#sdpAppearanceAccordion")` is non-null with `open === false`.
     - `#sdpHomeGreeting`, `#sdpHeroConfigChips`, `#sdpHomeStatsRow`, `#sdpQuickPracticeGrid`, `#sdpWordFilterRow`, `#microToastLoad`, `#creditPill`, `#creditDocked`, `#sdpDesktopRail` exist.
2. In `tests/upgrade-browser.cjs` and `tests/browser.cjs`:
   - Add explicit visibility/absence assertions in `tests/upgrade-browser.cjs`:
     - `.topbar` height <= 56px, `top === 0`, and `#topDataBadge` has `offsetParent === null`.
     - On `#screen-home`, `#v58VoiceBadge`, `#segMode`, `#homeMeta`, `#homeStats`, `.v58-bento`, `.v58-rail`, and `.sdp-retry-toast` all have `offsetParent === null`, while `#sdpHomeGreeting`, `#homeHero`, `#sdpHeroConfigChips`, `#sdpHomeStatsRow`, and `#sdpQuickPracticeGrid` have `offsetParent !== null`.
     - After clicking `#tab-set` (`UI.setTab('set')`), `#sdpNextGenSettings` is visible near top (`getBoundingClientRect().top < 140`) and `#setBody` is inside collapsed `<details id="sdpAppearanceAccordion">` (`open === false`).
     - In active Dictation (`Eng.start({})`), `#sdpCockpitCard`, `#sdpEdgeBar`, `#sdpTimerPill`, `#sdpCockpitDock`, and `#sdpWordMapCard` are visible and `.lens` has `offsetParent === null`.
   - If any legacy check in `tests/browser.cjs`, `tests/e2e.cjs`, `tests/live-lab.cjs`, or `tests/audit-v42.cjs` fails because a retired v58 element (`.v58-workspace`, `.v58-rail`, topbar `⋯` menu, or un-collapsed `#setBody` card) is now hidden, update that specific test check to assert the v60 element instead — NEVER un-hide legacy v58 UI in product code!
3. Run all 9 gates G1..G9 (R10) using `timeout 120` and record results in `.work/v60-9003/PROGRESS.md`.
4. Commit `"v60-9003 P5: lockstep test gates and legacy clutter absence assertions"` and push.

### P6 — DOCS, PR, MERGE (budget <= 12 calls)
1. Update `version.json` and `data/version.json` notes with the `v9.0.0.3 (v60)` release summary. Run `git rm -rf .work/v60-9003`, run `timeout 120 sh -c 'node tests/check.cjs && node --test tests/upgrade.test.cjs' > /tmp/p6-cheap.log 2>&1; echo "exit=$?"`, commit `"Release v9.0.0.3 (v60): Next-Gen Hurubuhuti UI complete replacement"`, `git push -u origin HEAD`.
2. PR (W10): use your built-in push/create-PR capability if you have one; otherwise REST: `gh api repos/dictationb1/dictationb1.github.io/pulls -f title="Release v9.0.0.3 (v60): Next-Gen Hurubuhuti UI Complete Replacement" -f head="$(git branch --show-current)" -f base=main -f body="Wraps Screens.home/dict/settings and Eng.openPlayer to permanently replace legacy v57/v58/v59 UI; adds self-healing SW cache eviction (9.0.0.3)." --jq '.number'` (`gh pr create` uses GraphQL, which may be blocked). Reuse an existing open PR for the branch if there is one.
3. MERGE policy: merge (with the platform's merge button/capability, or `gh api -X PUT repos/dictationb1/dictationb1.github.io/pulls/<N>/merge -f merge_method=merge`) ONLY if EVERY gate G1..G9 is PASS (no FAIL, no ENV-BLOCKED). Otherwise STOP after opening the PR and print `https://github.com/dictationb1/dictationb1.github.io/compare/main...feat/v60-nextgen-9-0-0-3?expand=1`. Never force-push.
4. FINAL REPORT (<= 25 lines): PR URL + merge status; sizes of `index.html`, `data.html`, `data/learning-tools.js`, `data/studio.js`; table of every gate G1..G9 with PASS / FAIL / ENV-BLOCKED; for each ENV-BLOCKED gate the exact command the human should run locally; every assumption and every adapted anchor. Do not claim success without evidence from the logs.

## 3. HELPER FILES
~~~js
// .work/v60-9003/peek.cjs   usage: node .work/v60-9003/peek.cjs FILE "needle" [radius=140] [maxHits=5]
var fs = require("fs");
var file = process.argv[2], needle = process.argv[3];
var radius = +process.argv[4] || 140, maxHits = +process.argv[5] || 5;
var s = fs.readFileSync(file, "utf8"), i = -1, shown = 0;
while (shown < maxHits && (i = s.indexOf(needle, i + 1)) >= 0) {
  shown++;
  console.log("@" + i + ": " + s.slice(Math.max(0, i - radius), i + needle.length + radius).replace(/\n/g, "\\n"));
}
console.log("shown " + shown + " | total occurrences " + (s.split(needle).length - 1));
~~~
~~~js
// .work/v60-9003/patchlib.cjs   usage (from the repo root):
//   var p = require("./patchlib.cjs").open("index.html", ["</html>", "<body", "<script"]);
//   p.rep("label", "exact old text", "new text", 1); p.regex("label", /re/g, function (m) { return "..."; }, 1); p.save(598000);
var fs = require("fs");
exports.open = function (file, sigTokens) { /* ...as delivered in the task... */ };
~~~
~~~js
// .work/v60-9003/strgen.cjs   usage: var strgen = require("./strgen.cjs"); strgen.toAsciiJsLiteral(linesArray)
exports.escapeNonAscii = function (str) {
  return String(str).replace(/[\u0080-\uFFFF]/g, function (ch) {
    return "\\u" + ("0000" + ch.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
  });
};
exports.linesToJsExpr = function (lines) {
  return lines.map(function (l) { return exports.escapeNonAscii(JSON.stringify(String(l))); }).join(" + \"\\n\" +\n");
};
~~~
BEGIN NOW with P0.
