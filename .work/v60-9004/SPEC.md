# TASK — dictationb1/dictationb1.github.io: v60 (9.0.0.3) -> v60 (9.0.0.4) Zero-FOUC & 8-Bug Video Audit Fix
Work autonomously through phases P0..P6; each phase ends with verify + commit + push to branch `fix/v60-nextgen-9-0-0-4` so a new session can resume from the repo alone.
Ask no questions mid-run: choose the safest deterministic option that preserves all existing IDs and report it in P6.

STOP only on the listed STOP conditions in P0 (wrong repository or corrupt baseline) or P6 (after PR creation if any gate is ENV-BLOCKED or FAIL).

## 0. WORKING RULES
W1 SAVE THE SPEC. First action (skip if `.work/v60-9004/SPEC.md` exists): with your file-write tool (not `echo`), save this entire message, unabridged, as `.work/v60-9004/SPEC.md`. If your context is compacted or you are unsure of a detail, re-read that section from the file instead of guessing.
W2 RESUME. `git fetch origin --prune; git branch -r`. If `origin/fix/v60-nextgen-9-0-0-4` exists: check it out and read `.work/v60-9004/PROGRESS.md`; continue at the first unfinished phase. If the branch exists but has no PROGRESS.md, all work phases are finished: go straight to step 2 of the release phase (P6). If the branch does not exist: `git checkout -b fix/v60-nextgen-9-0-0-4 origin/main`. (If pushing that branch name is rejected, keep the session's own branch and use it everywhere instead.)
W3 PROTECT YOUR CONTEXT. Huge or minified files: `index.html`, `data/learning-tools.js`, `data/studio.js`, `data.html`, `data/index.html`, `data/words.js`. NEVER `cat`, `view`, `head`, `tail`, `sed -n`, plain `grep`, `git diff` or `git show` on them. Use only `wc -c`, `git diff --stat`, and `node .work/v60-9004/peek.cjs <file> "<needle>" [radius] [maxHits]`. Same rule for any file > 50 KB. Send command output to `/tmp/*.log` and read only `tail -n 40` or `grep -n -i -E "fail|error|assert"`. Put independent shell steps into ONE tool call.
W4 EDIT HUGE FILES ONLY THROUGH A PATCH-SCRIPT FILE built on `.work/v60-9004/patchlib.cjs`. Forbidden on them: `sed`, `perl -pi`, `awk` redirects, edit/str_replace tools, `node -e` one-liners, whole-file rewrites. Write every script with your file-write tool or a QUOTED heredoc (`cat > f <<'EOF'`); never put JavaScript inside a double-quoted shell string; write non-ASCII characters inside scripts as `\uXXXX` escapes.
W5 ANCHORS. Strings marked VERIFIED were checked against the repo (count given). Strings marked UNVERIFIED are hints: if `rep()` finds a different count, `peek` a short stem, adapt the anchor ONCE, re-run. Max 2 attempts per anchor.
W6 SAFETY NET. In P0 record baseline sizes. After every phase run the size check and `node tests/check.cjs && node --test tests/upgrade.test.cjs` (must pass from P1 on), then `git add -A && git commit -m "v60-9004 P<n>: <what>" && git push -u origin HEAD`, then tick the phase in `.work/v60-9004/PROGRESS.md`. If `index.html` grows by more than 15 KB over baseline, or the cheap check fails twice, run `git checkout -- <file>` and redo the phase with the patch script.
W7 NO ENDLESS LOOPS. Max 3 fix attempts per failing check. A gate failing for ENVIRONMENT reasons (no browser binary, blocked download or network, port in use) is ENV-BLOCKED: retry once, record it in PROGRESS.md, move on, and do NOT change product code to appease it. Never weaken or delete a test except the assertions the phases tell you to change.
W8 TIME LIMITS. Run every gate as `timeout 120 <cmd> > /tmp/<name>.log 2>&1; echo "exit=$?"`. If a command is moved to the background or hits its timeout, poll its log; do not start it again.
W9 CALL BUDGET. Each phase states a tool-call budget: batch commands to stay inside it. If you reach 1.5x a phase's budget, stop that phase, commit what works, write `NEXT:` plus what is left into PROGRESS.md, push, and end with the final report (a new session resumes from there).
W10 ONE PR. This chat session can create only ONE pull request. Create it once, in the last phase (P6); before creating, check for an existing open PR for the branch and reuse it.

## 1. GLOBAL RULES (R1..R10)
R1 ES5-STRICT. Every shipped browser script (`index.html`, `data.html`, `data/index.html`, `sw.js`, `data/learning-tools.js`, `data/studio.js`, `data/data-meter.js`, `data/words.js`) MUST parse under `new Function(src)` and Acorn `ecmaVersion: 5` (`var` and `function(){}` only; zero `let`, `const`, `=>`, template literals, `class`, `async`, `await`, `for..of`, destructuring, spread, or default parameters). All non-ASCII characters inside JS patch scripts MUST be written as `\uXXXX` escapes.
R2 BYTE BUDGETS. `index.html` <= 598,000 bytes (hard ceiling in `tests/check.cjs` is 600,000 bytes; baseline at `ef6cdfa` is 484,800 bytes). `data.html` and `data/index.html` <= 60,000 bytes each and MUST be byte-for-byte identical (`cmp -s data.html data/index.html`). No static `<link>` tags for fonts or stylesheets in `index.html`.
R3 VERSION STAMPS VS PROTECTED IDENTIFIERS.
  - Version stamps to set: `ver` = `60`, `APP_VERSION` = `"9.0.0.4"`, `version` = `"9.0.0.4"`, `appVersion` = `"9.0.0.4"`, `schema` = `60`, `settingsRev` = `60`, `SW_VERSION` = `'sdp-v60-9.0.0.4'`, script cache-bust query `?v=9.0.0.4`.
  - Protected identifiers that MUST NEVER be renamed: `#sdpV57Css`, `#sdpV58Css`, `#sdpLearnCss`, `#sdpDataSheetCss`, `#v58Dock`, `v58-keyboard`, `#v58ContextNextBtn`, `#v58VoiceBadge`, `v58-sig-pill`, `v59-dict-card`, `v59-ipa`, `v59-pos`, `sdp_onboard_v58`, `sdp_sr_v2`, `sdp_gam_v2`, `sdp-youdao-v1`, `SDP_ENC_V2`.
R4 PRESERVED DOM IDS. Never delete these IDs from the document (move retired visual elements into `<div id="sdpLegacyKeeper" hidden style="display:none!important"></div>` or collapsed `<details id="sdpAppearanceAccordion">` so `document.getElementById` never returns `null`): `#app`, `.topbar`, `#brandName`, `#brandSub`, `#chipNet`, `#btnLock`, `#btnLiveVideo`, `#btnLang`, `#btnGuideTop`, `#btnPerf`, `#btnTheme`, `#btnRefresh`, `#topDataBadge`, `#btnAdmin`, `#tabbar`, `#tab-home`, `#tab-dict`, `#tab-comm`, `#tab-set`, `#screen-home`, `#homeAnn`, `#homeHero`, `#homeKicker`, `#homeTitle`, `#homeSub`, `#homeMeta`, `#homeResume`, `#btnStart`, `#btnStartText`, `#btnGuide`, `#segMode`, `#homeStats`, `#homeSessions`, `#screen-dict`, `#dictSearch`, `#dictTabs`, `#dictList`, `#screen-comm`, `#btnCompose`, `#screen-set`, `#setBody`, `#rateRange`, `#volRange`, `#repeatsSelect`, `#readSentenceToggle`, `#writeSecsRange`, `#bitrateSelect`, `#layers`, `#sheets`, `#modals`, `#toasts`, `#credit`, `#dataSheet`, `#plCount`, `#plBars`, `#plFill`, `#plStatus`, `#plWord`, `#plHint`, `#plRing`, `#plPlay`, `#cdFg`, `#cdNum`, `#ansInput`.
R5 THE 8 LIVE VIDEO BUGS THAT MUST BE FIXED IN THIS BUILD (`ef6cdfa` POST-MORTEM).
  A live screen recording of `ef6cdfa` on mobile Brave (`https://dictationb1.github.io/`) revealed 8 severe bugs that escaped the previous gates:
  - **BUG 1 (8-Second Multi-Stage FOUC Flash of v57 -> v58 -> v59 -> v60 on Load)**: On load, the user sees the old v57 UI (`⚡ Lite`, `Dictionary | Community`), then the v58 UI (`0.07 MB · Rs. 0.01`, `Make 100% Offline Ready`, `4-Choice Quiz`), then a half-width tabbar, before v60 settles 8 seconds later.
    *Fix*: Inject an inline `<style id="sdpPrePaintCloak">` right inside `<head>` of `index.html` that sets `html,body{background:#09090B!important;color:#FAFAFA!important} body:not([data-v60-ready="1"]) #app, body:not([data-v60-ready="1"]) .topbar, body:not([data-v60-ready="1"]) #tabbar{opacity:0!important;pointer-events:none!important}` with a 900ms safety fallback timer in `<head>`, and set `document.body.setAttribute("data-v60-ready","1")` at the end of `mountNextGenUI()` in `data/learning-tools.js`! Also short-circuit the legacy v58/v59 DOM-injecting `setTimeout`s inside `data/learning-tools.js` so v58/v59 never inject `Make 100% Offline Ready`, `Session progress 0/30`, or `.v58-bento`.
  - **BUG 2 (Topbar Text Bleeding & Overlapping Behind Swan Logo on Scroll)**: In `.topbar`, legacy children (`#brandName`, `#chipNet`, `#btnLock`) remained inside `.topbar` behind the swan badge (showing garbled text like `"Jad"` / `"3pe"` / `"ngert"` inside the brand box) and scrolling page content bled right through the topbar!
    *Fix*: Make `.topbar` a full-width solid header (`position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;max-width:none!important;height:56px!important;margin:0!important;padding:0 14px!important;background:#09090B!important;border:none!important;border-bottom:1px solid rgba(255,255,255,0.09)!important;border-radius:0!important;z-index:120!important;`). Move ALL pre-existing children of `.topbar` (including `.brand`, `#brandName`, `#brandSub`, `#chipNet`, `#btnLock`, etc.) into `#sdpLegacyKeeper` (`display:none!important`), and render clean `#sdpBrandCluster` and `#sdpTopActions` as the ONLY children of `.topbar`!
  - **BUG 3 (`#creditDocked` Floating Fixed Over Interactive Controls on Every Screen)**: `#creditDocked` (`🦢 Crafted by Hansana`) was styled with `position:fixed;bottom:72px`, so it floated on top of the Dictation `Next` button, the Settings `Volume` slider, and the Home `Quiz` card!
    *Fix*: `#creditDocked` MUST be `position:static!important;display:flex!important;justify-content:center!important;margin:16px auto 8px!important;pointer-events:none!important;` placed inside `#screen-home` at the bottom of the scroll flow (and `#creditDockedDesktop` inside `#sdpDesktopRail`), NEVER `position:fixed`!
  - **BUG 4 (Tapping `Words` Tab `#tab-dict` Shows a Completely Blank Screen)**: Tapping `Words` showed an empty dark page with only the old v58 footer at the bottom!
    *Fix*: When `#tab-dict` is clicked, call `UI.setTab("dict")`, force `#screen-dict` visible (`#screen-dict:not(.hidden){display:block!important;opacity:1!important;visibility:visible!important}`), and ensure `Screens.dict()` synchronously renders all 30 `.sdp-word-card` items from `Lib.current().words` (with fallback to `DB.data.lists` / `window.WORDS_DATA`) into `#dictList` (`display:flex!important;flex-direction:column!important;gap:10px!important;min-height:200px!important;`).
  - **BUG 5 (Dictation Player Is a Split-Screen Frankenstein That Auto-Scrolls Down to Old `.ctrlgrid`)**: In `.layer.player`, the old `#plCount` (`Dictation #1 of 30` + 30 dots), the old `.wordcard` inner elements (`Dictation #1 of 30` blue pill, `• • • • • •` 6 dots, `word · Personal Feelings...`, `Tap the eye icon...`, `Screen stays awake...`), the old 7-button `.ctrlgrid` (`Repeat word`, `Repeat sentence`, etc.), and the old `.lfoot` (`Finish early`, `Restart`) were ALL visible, and on every word beat the layer scrolled down to `.ctrlgrid`, hiding `#sdpCockpitCard`!
    *Fix*:
    1. In `Eng.start` / `Eng.readyScreen`: bypass the old `"Are you ready? I'm ready"` sheet on student dictation start (or when `window.__SDP_SKIP_READY__ !== false`, immediately unlock speech and call `this.runItem(0)` so clicking `Start dictation` opens the Cockpit directly; keep `Eng.readyScreen` callable when directly invoked by unit tests).
    2. Inside `.layer.player`: move `.ctrlgrid` and `.lfoot` into a `0x0` off-screen wrapper (`position:fixed!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;`) so Playwright tests can still query their buttons in the DOM if needed, while they take ZERO layout height and NEVER cause `.layer .lbody` to scroll!
    3. Inside `.wordcard` (`#sdpCockpitCard`), hide all legacy children (`#plWord`, `#plHint`, `#plWake`, and any v58 pills/dots) when `Eng.showWord` is false (`display:none!important`), and show ONLY `#sdpEdgeBar`, `#sdpCockpitHeaderRow`, `#sdpCockpitStage`, `#sdpCockpitDock`, and `#sdpCockpitFoot`, followed below the card by `#sdpCockpitCounters` and `#sdpWordMapCard`!
  - **BUG 6 (`[Test voice]` & `#sdpTopVoiceBtn` Spell Out `"T - H - I - S - I - S - A - L - I - C - E"` Letter-by-Letter and Crash with `"Something small went wrong"`)**:
    *Root cause*: `Speech.say(items, opts, cb)` in `index.html` expects `items` to be an **ARRAY of strings** (`["This is Alice, your UK English dictation voice."]`). Passing a bare string `"This is Alice..."` causes `Speech.say` to loop `for (i=0; i<items.length; i++)` over every single character (`"T"`, `"h"`, `"i"`, `"s"`...) making 25 separate Youdao requests and throwing an error!
    *Fix*: Wrap `Speech.say` globally (`var origSay = Speech.say; Speech.say = function(items, opts, cb) { if (typeof items === "string") items = [items]; return origSay.call(this, items, opts, cb); };`) AND ensure `#sdpTopVoiceBtn` and `#sdpBtnTestVoice` pass `["This is Alice, your UK English dictation voice."]`.
  - **BUG 7 (Settings Screen Shows Leaked `"Paste blocked?..."`, `Word repeats [Twice]`, and `Smart Dictation Player v58` Footer)**:
    *Fix*: In `#screen-set`, hide EVERY child except `#sdpNextGenSettings` (`#screen-set > *:not(#sdpNextGenSettings) { display: none !important; }`) and move `#setBody` and any v58-appended siblings (`#repeatsSelect` wrapper, paste-blocked hint) inside `<details id="sdpAppearanceAccordion">`!
  - **BUG 8 (Home Screen & Practice Screen Still Show Legacy `Session progress 0/30` Card, Old v58 Practice Hub, and `Smart Dictation Player v58 · Created by Hansana` Footer)**:
    *Fix*: Hide `#staticFooter`, `.v58-footer`, `.v58-session-prog`, and any element containing `"Smart Dictation Player v58"` globally (`display:none!important`). On `#screen-home`, hide every direct child except `#homeAnn`, `#homeResume`, `#sdpHomeGreeting`, `#homeHero`, `#sdpHomeStatsRow`, `#sdpQuickPracticeGrid`, and `#creditDocked`. On `#screen-comm` / Practice screen, style the Practice Hub cards cleanly with the Zinc-900 / Sky-400 flat design system (`#18181B` cards, `#38BDF8` active tab pill).
R6 CASCADE SUPREMACY. Keep `#sdpV57Css` and `#sdpV58Css` nodes in `document.head` with `.disabled = true` and `.textContent = "/* v60 neutralised */"`. Keep `#sdpNextGenCss` as the last child of `document.head`.
R7 DESIGN SYSTEM TOKENS (`#sdpNextGenCss`). Canvas `#09090B`; Card `#18181B`; Elevated `#222226`; Border `rgba(255,255,255,0.08)`; Text `#FAFAFA`; Muted `#A1A1AA`; Accent `#38BDF8` (ink `#062530`); Listen `#38BDF8`; Write `#FBBF24`; Review `#4ADE80`; Danger `#F87171`; zero `backdrop-filter`.
R8 SELF-HEALING SERVICE WORKER (`9.0.0.4`). Same fault-tolerant per-entry `install` caching and Network-First HTML/JS/JSON `fetch` strategy as `9.0.0.3`, bumped to `9.0.0.4` / `sdp-v60-9.0.0.4`.
R9 SECURITY & STUDIO INVARIANTS. Zero hardcoded PINs/keys/tokens; `SDP_ENC_V2` at `250000` PBKDF2 iterations; default model `"eleven_flash_v2_5"`, default voice `"Xb7hH8MSUJpSbSDYk0k2"`.
R10 GATES & CHEAP CHECK.
  - `<CHEAP_CHECK>`: `node tests/check.cjs && node --test tests/upgrade.test.cjs` (~4s).
  - Full gates G1..G9 (run via `timeout 120 <cmd> > /tmp/<name>.log 2>&1; echo "exit=$?"`):
    - G1 `node tests/check.cjs` · G2 `node --test tests/upgrade.test.cjs` · G3 `node tests/phase1.cjs` · G4 `node tests/server.cjs` · G5 `node tests/browser.cjs` · G6 `node tests/upgrade-browser.cjs` · G7 `node tests/e2e.cjs` · G8 `node tests/live-lab.cjs` · G9 `node tests/audit-v42.cjs`.

## 2. PHASES

### P0 — PREFLIGHT (budget <= 8 calls)
1. Do W1 and W2. Note `git log -1 --oneline` (expected: `ef6cdfa` or `8d7e1c3`; if different, continue and report it).
2. Baseline: `wc -c index.html data.html data/index.html data/learning-tools.js data/studio.js sw.js`; `index.html` must be within `450000..598000` bytes and `data.html` within `40000..60000` bytes, else STOP and report. Record sizes in `.work/v60-9004/PROGRESS.md`.
3. `node -v`. Install dependencies with `npm ci --prefix tests` only if `tests/node_modules` is missing. Run `<CHEAP_CHECK>` once on baseline and record PASS/FAIL.
4. ONE probe call: check browser binaries and `gh api repos/dictationb1/dictationb1.github.io --jq .full_name`. Record in PROGRESS.md.
5. Create `.work/v60-9004/peek.cjs`, `.work/v60-9004/patchlib.cjs`, `.work/v60-9004/strgen.cjs` (Section 3) and `.work/v60-9004/PROGRESS.md`.
6. Commit `"v60-9004 P0: preflight and helpers"` and push.

### P1 — VERSION 9.0.0.4, ZERO-FOUC PRE-PAINT CLOAK IN `index.html` & SW BUMP (budget <= 10 calls)
Goal: Bump version stamps to `9.0.0.4` (`ver: 60`), inject `#sdpPrePaintCloak` into `<head>` of `index.html` to eliminate the 8-second FOUC flash of old v57/v58 UIs (Bug 1), and update version checks in `tests/check.cjs`, `tests/upgrade.test.cjs`, and `tests/server.cjs`.
Edits:
1. JSON stamps (`version.json`, `data/version.json`, `data/config.json`, `data/session.json`):
   - Write and run `.work/v60-9004/p1-json.cjs` to set `ver = 60`, `version = "9.0.0.4"`, `appVersion = "9.0.0.4"`, `schema = 60`, `settingsRev = 60`.
2. `sw.js`:
   - Patch `sw.js` via `patchlib.cjs` to replace `9.0.0.3` with `9.0.0.4` (`VERSION = 'sdp-v60-9.0.0.4'`, `APP_VERSION = '9.0.0.4'`).
3. `index.html`, `data.html`, `data/index.html`:
   - Use `peek.cjs` on `index.html` around `<head>`, `sdpSwBoot`, `APP_VERSION`, and `learning-tools.js`.
   - Write and run `.work/v60-9004/p1-html.cjs` using `patchlib.cjs`:
     - Replace `9.0.0.3` with `9.0.0.4` in `index.html` (`APP_VERSION="9.0.0.4"`, `#sdpSwBoot` version `"9.0.0.4"`, `?v=9.0.0.4` on script tags).
     - Inject `<style id="sdpPrePaintCloak">html,body{background:#09090B!important;color:#FAFAFA!important}body:not([data-v60-ready="1"]) #app,body:not([data-v60-ready="1"]) .topbar,body:not([data-v60-ready="1"]) #tabbar{opacity:0!important;pointer-events:none!important}</style>` right after `#sdpSwBoot` in `<head>`, and add a 900ms fallback inside `#sdpSwBoot` (`setTimeout(function(){if(document.body)document.body.setAttribute("data-v60-ready","1");},900);`) so even if a script is slow, the page never stays blank.
     - Save `index.html` with `p.save(598000)`.
     - Update `9.0.0.3` -> `9.0.0.4` in `data.html`, save with `p.save(60000)`, and copy `data.html` to `data/index.html`.
4. `tests/check.cjs`, `tests/upgrade.test.cjs`, `tests/server.cjs`:
   - Update version string assertions from `9.0.0.3` to `9.0.0.4`.
5. Run `<CHEAP_CHECK>`, commit `"v60-9004 P1: version 9.0.0.4 and pre-paint FOUC cloak"`, and push.

### P2 — FIX `Speech.say` LETTER-BY-LETTER BUG, LEGACY V58 TIMERS & TOPBAR BLEEDING (budget <= 10 calls)
Goal: Fix Bug 1 (legacy v58/v59 timers inside `data/learning-tools.js`), Bug 2 (`.topbar` full-bleed solid header with zero leaked `.brand`/`#btnLock` text behind the swan icon), Bug 3 (`#creditDocked` static positioning so it never overlaps buttons), Bug 6 (`Speech.say` string-to-array normalization so `[Test voice]` speaks whole sentences instead of spelling `"T-H-I-S"` and crashing), and Bug 8 (hiding `Session progress 0/30` and `Smart Dictation Player v58` footer).
Edits:
1. Use `peek.cjs` on `data/learning-tools.js` to locate:
   - Where the legacy v58/v59 initialization functions run in the first half of `data/learning-tools.js` (e.g. `Session progress`, `Make 100% Offline Ready`, `Smart Dictation Player v58`).
   - Where `.topbar`, `#sdpBrandCluster`, `#creditDocked`, `#sdpTopVoiceBtn`, and `#sdpBtnTestVoice` are built in the v60 section of `data/learning-tools.js`.
2. Write and run `.work/v60-9004/p2-chrome-audio.cjs` using `patchlib.cjs`:
   - **Fix Bug 6 (`Speech.say` String vs Array Crash)**:
     - Wrap `window.SDPCore.Speech.say` (and `Speech.say`) at boot so that if the first argument `items` is a `string`, it is automatically wrapped as `[items]` (`if (typeof items === "string") items = [items];`).
     - Also ensure `#sdpTopVoiceBtn` and `#sdpBtnTestVoice` call `Speech.say(["This is Alice, your UK English dictation voice."], { rate: 0.9, volume: 1 }, function(){})` and never trigger the global error toast!
   - **Fix Bug 2 (`.topbar` Full-Bleed Solid Bar & Zero Bleed-Through)**:
     - In `mountChrome()`, iterate over ALL child nodes of `.topbar`. Any child of `.topbar` whose `id` is NOT `"sdpBrandCluster"` and NOT `"sdpTopActions"` (including `.brand`, `#brandName`, `#brandSub`, `#chipNet`, `#btnLock`, `.top-actions`, etc.) MUST be moved into `#sdpLegacyKeeper` (`display:none!important`)!
     - Inside `#sdpBrandCluster`, create a clean title span (`Smart Dictation` + `<span id="sdpVerPill">v60</span>`) and subtitle span (`CCBE Galle Branch`), and if `#brandName` / `#brandSub` are needed by tests, place `#brandName` and `#brandSub` cleanly inside `#sdpBrandCluster` with zero overlapping siblings.
     - In `#sdpNextGenCss`, enforce:
       ~~~css
       .topbar, .topbar.glass {
         position: fixed !important;
         top: 0 !important;
         left: 0 !important;
         right: 0 !important;
         width: 100% !important;
         max-width: none !important;
         height: 56px !important;
         margin: 0 !important;
         padding: 0 14px !important;
         background: #09090B !important;
         border: none !important;
         border-bottom: 1px solid rgba(255,255,255,0.09) !important;
         border-radius: 0 !important;
         box-shadow: 0 4px 16px rgba(0,0,0,0.6) !important;
         z-index: 120 !important;
         transform: none !important;
         display: flex !important;
         align-items: center !important;
         justify-content: space-between !important;
         box-sizing: border-box !important;
       }
       ~~~
   - **Fix Bug 3 (`#creditDocked` Must NEVER Float Over Content)**:
     - Change `#creditDocked` CSS to `position: static !important; transform: none !important; display: flex !important; align-items: center !important; justify-content: center !important; width: fit-content !important; margin: 18px auto 6px !important; pointer-events: none !important;` and append `#creditDocked` as the last child of `#screen-home` (NOT `document.body`!).
   - **Fix Bug 1 & Bug 8 (Hide Legacy `Session progress 0/30` & `Smart Dictation Player v58` Footer & Set `data-v60-ready="1"`)**:
     - In `#sdpNextGenCss`, enforce:
       ~~~css
       #staticFooter, .v58-footer, .v58-session-prog, .v58-offline-card,
       #screen-home > *:not(#homeAnn):not(#homeResume):not(#sdpHomeGreeting):not(#homeHero):not(#sdpHomeStatsRow):not(#sdpQuickPracticeGrid):not(#creditDocked) {
         display: none !important;
       }
       ~~~
     - Also scan `#screen-home`, `#screen-dict`, `#screen-comm`, `#screen-set`, and `document.body` on render and hide any legacy div whose textContent starts with `"Session progress"` or `"Smart Dictation Player v58"`.
     - At the end of initial `mountNextGenUI()`, set `document.body.setAttribute("data-v60-ready", "1")` so the pre-paint cloak lifts only after the v60 DOM is completely mounted!
3. Run `node --check data/learning-tools.js` and `<CHEAP_CHECK>`, commit `"v60-9004 P2: fix Speech.say array bug, solid topbar, static creditDocked, and FOUC lift"`, and push.

### P3 — FIX BLANK `WORDS` TAB (BUG 4), SETTINGS LEAKS (BUG 7) & PRACTICE STYLING (budget <= 10 calls)
Goal: Fix Bug 4 (`Words` tab `#tab-dict` showing a blank screen at `00:21` in the video), Bug 7 (Settings screen showing leaked `"Paste blocked?..."` and `Word repeats [Twice]` outside the Priority 3 accordion), and clean up the Practice screen (`#screen-comm`).
Edits:
1. Use `peek.cjs` on `data/learning-tools.js` to inspect how `#tab-dict`, `Screens.dict`, `#screen-dict`, and `Screens.settings` are currently wired.
2. Write and run `.work/v60-9004/p3-words-settings.cjs` using `patchlib.cjs`:
   - **Fix Bug 4 (`Words` Tab `#screen-dict` Blank Screen)**:
     - Find why `#screen-dict` was blank when `#tab-dict` was tapped:
       - Ensure clicking `#tab-dict` (and the desktop rail `Words` button) calls `UI.setTab("dict")` AND explicitly removes `.hidden` from `#screen-dict`, sets `#screen-dict.style.display = "block"`, and calls `Screens.dict()`.
       - In `#sdpNextGenCss`, ensure NO rule hides `#screen-dict` or `#dictList` (`#screen-dict:not(.hidden) { display: block !important; opacity: 1 !important; visibility: visible !important; } #screen-dict #dictList { display: flex !important; flex-direction: column !important; gap: 10px !important; opacity: 1 !important; visibility: visible !important; }`).
       - In the wrapped `Screens.dict()`, obtain the word list reliably: try `(window.SDPCore && SDPCore.Lib && SDPCore.Lib.current() && SDPCore.Lib.current().words)`, fallback to `(window.DB && DB.data && DB.data.lists && DB.data.lists[0] && DB.data.lists[0].words)`, fallback to `window.WORDS_DATA || []`.
       - Render the sticky `#dictSearch` input + `#sdpWordFilterRow` (`All`, `Weak`, `Mastered`, `A\u2013Z`) + all matching `.sdp-word-card.wordcard.v59-dict-card` cards directly into `#dictList` (numbered `1..30`, bold word, Sky-400 `/IPA/` `.v59-ipa`, italic POS `.v59-pos`, full English meaning, full example sentence with target word bolded, `.sdp-si-pill` Sinhala chip, and right-side `[Play]` and `[Slow]` buttons).
   - **Fix Bug 7 (Settings Leaked `"Paste blocked?..."` & `Word repeats [Twice]` Elements)**:
     - In `index.html`, the v58 inline script appends a `"Paste blocked?..."` hint and a `"Word repeats"` `<select id="repeatsSelect">` wrapper directly to `#screen-set` (as siblings after `#setBody`).
     - In wrapped `Screens.settings()` (and via CSS `#screen-set > *:not(#sdpNextGenSettings) { display: none !important; }`), move `#setBody` AND every other child of `#screen-set` except `#sdpNextGenSettings` **inside** `<details id="sdpAppearanceAccordion">`!
     - Inside `<details id="sdpAppearanceAccordion">`, keep `#rateRange, #volRange, #repeatsSelect, #readSentenceToggle, #writeSecsRange, #bitrateSelect` in the DOM (so gates find them) while hiding the duplicate legacy Voice/Dictation/Paste-blocked blocks (`display:none!important`) so opening `PRIORITY 3 · APPEARANCE (OPTIONAL)` shows only Appearance/Wallpaper/Studio controls cleanly!
   - **Clean Up Practice Screen (`#screen-comm`)**:
     - Style `#screen-comm` in `#sdpNextGenCss` so the mode tabs (`Flashcards`, `Quiz`, `Audio list`, `Sentence Context`) and practice stage use flat `#18181B` cards, `1px solid rgba(255,255,255,0.09)` borders, and `#38BDF8` active pills (no neon blue gradients, no v58 footer).
3. Run `node --check data/learning-tools.js` and `<CHEAP_CHECK>`, commit `"v60-9004 P3: fix blank Words tab, Settings leaked elements, and Practice styling"`, and push.

### P4 — FIX DICTATION PLAYER SPLIT-SCREEN & AUTO-SCROLL BUG (BUG 5) (budget <= 10 calls)
Goal: Fix Bug 5 (`00:33–01:16` in the video) where starting dictation shows the old `"Are you ready?"` modal first, renders duplicate legacy pills (`Dictation #1 of 30`, 6 dots, `word · Personal Feelings...`, `Tap the eye icon...`) inside `.wordcard`, and violently auto-scrolls down to the old 7-button `.ctrlgrid` and `[Finish early | Restart]` bar on every word beat!
Edits:
1. Use `peek.cjs` on `data/learning-tools.js` to inspect how `Eng.openPlayer`, `Eng.paint`, `Eng.paintCountdown`, and `Eng.readyScreen` are currently wrapped.
2. Write and run `.work/v60-9004/p4-cockpit.cjs` using `patchlib.cjs`:
   - **1. Streamline `Eng.readyScreen`**:
     - When `Eng.start()` calls `this.readyScreen()`, if not running a legacy test that explicitly inspects `#readyNum`, auto-unlock speech and start `this.runItem(0)` after a crisp 150ms transition (or render a sleek in-card `"Starting in 3..2..1"` inside `#sdpCockpitStage` instead of opening the clunky old bottom sheet `"Are you ready?"` over the player!). Keep `#readyNum` updated in DOM so any test checking `#readyNum` still passes.
   - **2. Eliminate the Split-Screen & Auto-Scroll to `.ctrlgrid`**:
     - Why did `.layer.player` scroll down on every beat in the video? Because `.ctrlgrid` (the 7 huge old buttons) and `.lfoot` (`Finish early`, `Restart`) were still in normal document flow below `#sdpWordMapCard`, making `.layer .lbody` 1,400px tall!
     - In `#sdpNextGenCss` and `Eng.openPlayer` wrapper:
       - Hide the legacy progress header above the card (`#plCount`, `#plBars`, and the `.bar.thin` parent of `#plFill`) with `position:fixed!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;`.
       - Hide `.lens` (`display:none!important`).
       - Move `.ctrlgrid` and `.lfoot` out of layout flow using `position:fixed!important;left:-9999px!important;top:0!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;` (do NOT use `display:none` if `e2e.cjs` queries them, or check how `e2e.cjs` clicks `Next` / `Finish early` — better yet: give the visible cockpit `[Skip/Next]` button in `#sdpCockpitFoot` and a quiet `[Finish]` button in the cockpit header the exact text/handlers or forward clicks, and check `e2e.cjs` in P5!).
       - Inside `#sdpCockpitCard` (`.wordcard`), hide ALL legacy v58/base children (`#plWord`, `#plHint`, `#plWake`, `.v58-word-pill`, the blue `"Dictation #1 of 30"` badge, the 6 white dots `• • • • • •`, the `"word · Personal Feelings..."` box, and `"Tap the eye icon..."`) unless `Eng.showWord` is true (when `Eng.showWord` is true, display `#plWord` cleanly inside `#sdpCockpitStage`).
       - Force `.layer.player .lbody` to `overflow-y: auto; scroll-behavior: auto;` and after every `Eng.paint()`, force `layer.querySelector(".lbody").scrollTop = 0` so the Cockpit NEVER jumps or scrolls away from `#sdpCockpitCard`!
   - **3. Verify Cockpit Layout Matches Mockup 6.2**:
     - Top of `.layer.player`: `.lhead` with left `32x32px` cyan swan badge + `Dictation` (`Session 8 \u00b7 Feelings (Adj)`), right `[Eye]` toggle (`showWord`), `[Finish]` pill button (`Eng.finishEarly()`), and `[X]` close button.
     - Card `#sdpCockpitCard`:
       - `4px` `#sdpEdgeBar` (`#sdpEdgeBarFill`: `#38BDF8` listening, `#FBBF24` writing, `#4ADE80` revealed).
       - `#sdpCockpitHeaderRow`: left `Word N of 30` (`#sdpCockpitWordOf`), center phase chip (`#plStatus`: `\u25CF Listening`, `\u25CF Writing time`), right `34px` `#sdpTimerPill` (`#cdNum` `05.0s` + `24px` `#cdFg` micro-ring).
       - `#sdpCockpitStage`: `DICTATION N` kicker + `#sdpLetterSlots` (7 dark rounded letter boxes `36x44px` in paper mode, or `#ansInput` in typing mode) + caption `Write on paper \u00b7 the word was read twice`.
       - `#sdpCockpitDock`: 4-column button grid (`Repeat`, `Slower`, `Sentence`, `Spell it`).
       - `#sdpCockpitFoot`: left `\uD83C\uDDEC\uD83C\uDDE7 Alice \u00b7 studio voice \u00b7 0.90\u00d7`, right `[Pause]` (`Eng.playPause()`) and `[Next]` (`Eng.next()`) buttons.
     - Below `#sdpCockpitCard`: `#sdpCockpitCounters` (`CORRECT`, `MISSED`, `STREAK`) + `#sdpWordMapCard` (`Word map` `N / 30` + `10x3` numbered grid `1..30`).
3. Run `node --check data/learning-tools.js` and `<CHEAP_CHECK>`, commit `"v60-9004 P4: fix dictation cockpit split-screen, legacy inner clutter, and scroll lock"`, and push.

### P5 — LOCKSTEP TEST GATES & VIDEO-BUG REGRESSION CHECKS (budget <= 12 calls)
Goal: Add explicit assertions for all 8 video bugs into `tests/check.cjs` and `tests/upgrade-browser.cjs`, inspect `tests/e2e.cjs` / `tests/browser.cjs` to ensure cockpit button selectors match the clean Cockpit, and run all 9 gates G1..G9.
Edits:
1. In `tests/check.cjs`:
   - Assert `APP_VERSION="9.0.0.4"`, `sw.js` `VERSION = 'sdp-v60-9.0.0.4'`, `#sdpPrePaintCloak` in `index.html`, `data-v60-ready` in `data/learning-tools.js`, `typeof items === "string"` guard in `Speech.say` wrapper.
2. In `tests/upgrade-browser.cjs`:
   - Add automated Chromium assertions verifying all 8 video fixes:
     1. `document.body.getAttribute("data-v60-ready") === "1"` and `#sdpPrePaintCloak` exists in `document.head`.
     2. `.topbar` has `width === window.innerWidth`, `top === 0`, and `.topbar` has ONLY 2 visible children (`#sdpBrandCluster` and `#sdpTopActions`) with zero leaked `#btnLock`/`#chipNet` text.
     3. `#creditDocked` has `getComputedStyle(el).position === "static"` (never `fixed`).
     4. Clicking `#tab-dict` (`Words` tab) makes `#screen-dict` visible and renders `>= 25` visible `.sdp-word-card` cards inside `#dictList` with `getBoundingClientRect().height > 60`.
     5. Clicking `#sdpTopVoiceBtn` or `[Test voice]` does NOT trigger any error toast in `#toasts`.
     6. On `#screen-set`, every sibling of `#sdpNextGenSettings` (including `"Paste blocked"` and `#repeatsSelect`) is hidden or inside collapsed `<details id="sdpAppearanceAccordion">`.
     7. In active Dictation (`Eng.start({})`), `.layer.player .lbody` `scrollTop === 0`, `#sdpCockpitCard` is at the top of the viewport (`getBoundingClientRect().top < 140`), and legacy `.ctrlgrid` does not push scroll height or appear in the visible viewport.
3. Run all 9 gates G1..G9 with `timeout 120`:
   - `timeout 120 node tests/check.cjs > /tmp/g-check.log 2>&1; echo "exit=$?"`
   - `timeout 120 node --test tests/upgrade.test.cjs > /tmp/g-upgrade.log 2>&1; echo "exit=$?"`
   - `timeout 120 node tests/phase1.cjs > /tmp/g-phase1.log 2>&1; echo "exit=$?"`
   - `timeout 120 node tests/server.cjs > /tmp/g-server.log 2>&1; echo "exit=$?"`
   - `timeout 120 node tests/browser.cjs > /tmp/g-browser.log 2>&1; echo "exit=$?"`
   - `timeout 120 node tests/upgrade-browser.cjs > /tmp/g-upbrowser.log 2>&1; echo "exit=$?"`
   - `timeout 120 node tests/e2e.cjs > /tmp/g-e2e.log 2>&1; echo "exit=$?"`
   - `timeout 120 node tests/live-lab.cjs > /tmp/g-livelab.log 2>&1; echo "exit=$?"`
   - `timeout 120 node tests/audit-v42.cjs > /tmp/g-audit42.log 2>&1; echo "exit=$?"`
   If `e2e.cjs` or `browser.cjs` clicks a player button (like `Finish early` or `Next`), ensure that button is either wired in the cockpit header/footer or accessible to Playwright without scrolling `.lbody` away from `#sdpCockpitCard`.
4. Commit `"v60-9004 P5: video-bug regression gates all green"` and push.

### P6 — DOCS, PR, MERGE (budget <= 12 calls)
1. Update `version.json` and `data/version.json` notes with the `v9.0.0.4 (v60)` summary. `git rm -rf .work/v60-9004`, run `<CHEAP_CHECK>` once more, commit `"Release v9.0.0.4 (v60): Zero-FOUC pre-paint cloak & 8 video audit fixes"`, `git push -u origin HEAD`.
2. PR (W10): use your built-in push/create-PR capability if you have one; otherwise REST: `gh api repos/dictationb1/dictationb1.github.io/pulls -f title="Release v9.0.0.4 (v60): Zero-FOUC Pre-Paint Cloak & 8 Live Video Fixes" -f head="$(git branch --show-current)" -f base=main -f body="Fixes 8-second FOUC flash, topbar text bleed, fixed creditDocked overlap, blank Words tab, split-screen auto-scrolling Dictation Cockpit, Speech.say character-by-character TTS bug, and Settings/Home v58 leaks." --jq '.number'`. Reuse an existing open PR for the branch if there is one.
3. MERGE policy: merge (with the platform's merge button/capability, or `gh api -X PUT repos/dictationb1/dictationb1.github.io/pulls/<N>/merge -f merge_method=merge`) ONLY if EVERY gate G1..G9 is PASS (no FAIL, no ENV-BLOCKED). Otherwise STOP after opening the PR and print `https://github.com/dictationb1/dictationb1.github.io/compare/main...fix/v60-nextgen-9-0-0-4?expand=1`. Never force-push.
4. FINAL REPORT (<= 25 lines): PR URL + merge status; sizes of `index.html`, `data.html`, `data/learning-tools.js`, `data/studio.js`; table of every gate G1..G9 with PASS / FAIL / ENV-BLOCKED; for each ENV-BLOCKED gate the exact command the human should run locally; every assumption and every adapted anchor. Do not claim success without evidence from the logs.

## 3. HELPER FILES
~~~js
// .work/v60-9004/peek.cjs   usage: node .work/v60-9004/peek.cjs FILE "needle" [radius=140] [maxHits=5]
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
// .work/v60-9004/patchlib.cjs   usage (from the repo root):
//   var p = require("./patchlib.cjs").open("index.html", ["</html>", "<body", "<script"]);
//   p.rep("label", "exact old text", "new text", 1); p.regex("label", /re/g, function (m) { return "..."; }, 1); p.save(598000);
var fs = require("fs");
exports.open = function (file, sigTokens) {
  var orig = fs.readFileSync(file, "utf8"), src = orig;
  function sig(s) { return (sigTokens || []).map(function (t) { return s.split(t).length; }).join("/"); }
  return {
    count: function (needle) { return src.split(needle).length - 1; },
    rep: function (label, from, to, expected) {
      var parts = src.split(from), n = parts.length - 1;
      if (n !== expected) { throw new Error("PATCH FAIL [" + label + "]: expected " + expected + " match(es), found " + n); }
      src = parts.join(to);
      console.log("ok   " + label + " x" + n);
    },
    regex: function (label, re, fn, minHits) {
      var n = 0;
      src = src.replace(re, function () { n++; return fn.apply(null, arguments); });
      if (n < (minHits || 1)) { throw new Error("PATCH FAIL [" + label + "]: regex matched " + n); }
      console.log("ok   " + label + " x" + n);
    },
    save: function (maxBytes) {
      var size = Buffer.byteLength(src, "utf8");
      if (size > maxBytes) { throw new Error("SIZE FAIL " + size + " > " + maxBytes + " (nothing written)"); }
      if (sig(src) !== sig(orig)) { throw new Error("STRUCTURE FAIL: signature counts changed (nothing written)"); }
      fs.writeFileSync(file + ".tmp", src);
      fs.renameSync(file + ".tmp", file);
      console.log("saved " + file + ": " + Buffer.byteLength(orig, "utf8") + " -> " + size + " bytes");
    }
  };
};
~~~
~~~js
// .work/v60-9004/strgen.cjs   usage: var strgen = require("./strgen.cjs"); strgen.linesToJsExpr(linesArray)
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
