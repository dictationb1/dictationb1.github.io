# Phase 1 candidate: QA and release report

> **Current release:** v5.4.0 / v48 (2026-10-29). The current app uses real remote Oxford/Youdao/Google audio and contains no local audio pack or generator. Run the nine current gates documented in `tests/README.md`. The v43/v46 commands, byte counts, audio manifests and release observations below are retained only as historical evidence and do not describe v48.

**Status: incomplete, not merged, not deployed.** Chromium ran successfully here. WebKit did not run locally because its executable is absent. Real WebKit subsequently passed on GitHub CI (see below). A real iPhone, Android phone and Windows PC were not available. The live Pages host could not be reached from this sandbox. Later phases have not started.

This report concerns **1.5.0-rc.1 / 2026-10-14**, not the older claims in `QA_REPORT.md`.

## B1–B8: what changed and what remains

| Bug | Before | Candidate now | Actual test / status |
| --- | --- | --- | --- |
| B1 | Commas were interpreted as columns per line; most pasted words were discarded. | Detect format once for the entire paste. The exact lecturer input yields 30 ordered entries including “go shopping”. Preview has all rows, edits, delete, drag and Up/Down; invalid/ambiguous input blocks publish. | `paste: exact lecturer paste`, CRLF, quotes, headers, bullets, 200-word and other Node fixtures; `chromium paste 30; edit/delete/reorder; 200 rows; direct publish preview; local PBKDF2 upgrade` PASS. Drag itself remains a manual check; automated ordering used Down. |
| B2 | Both sticky admin bars occupied `top:0`. | One sticky wrapper containing status and tabs, in normal flow. | Chromium geometry at 320/360/390/768/1280 widths, scrolled and reduced-height viewport PASS. A shortened viewport is **not** a real iOS keyboard test. |
| B3 | Only exact normalized `en-gb` matched. | Accepts UK aliases/subtags and named UK voices without overriding an explicitly non-UK language region. Re-polls on first gesture; clears a vanished voice. | Node language/name tests and four browser scenarios (five US voices / none / aliases / GB) PASS. Text mode remains reachable and never calls US speech. **UK audio packs/offline fallback and the requested main audio button are not implemented. B3 is only partially fixed.** |
| B4 | New and saved settings read a sentence by default. | One-time schema-2 migration sets sentence false and repeats two; later opt-in is preserved. Default sequence is Number, word, word. | `schema 2: old student data and custom PIN survive; defaults change only once`, `dictation: default beats…`, browser voice scenarios PASS. Existing resume/save regressions also passed. |
| B5 | No configured cloud endpoint; data stays local. | No new backend deployed. Existing Apps Script contract and mocks preserved. Publish confirmation explicitly says “this device only” in Local mode. | Existing mocked Apps Script tests PASS. **GitHub/Worker/D1 mode not implemented or verified.** |
| B6 | Manual, online-only dictionary fill, narrow example filter. | Unchanged in Phase 1 candidate. | Existing dictionary preservation tests PASS, but **automatic bank/fill requirements not implemented**. |
| B7 | Decorative blur/animations and one short idle probe. | Scrollable cards do not blur; Full allows only fixed bar/sheet blur; Lite disables filters/shadows/keyframes. Continuous 2-second foreground median probe downgrades Auto and respects manual choice. Preview rows are chunked. | Node live-downgrade test PASS; Chromium trace before/after collected at 6× CPU. **Performance budget is not demonstrated** (see below). |
| B8 | Default PIN literal in shipped HTML. | Precomputed salted verifier; next successful login re-salts and uses PBKDF2 when supported. Old custom hashes survive. Clear Web Crypto failure message, existing lockouts and recovery instructions retained. | Static no-literal test, independent Node PBKDF2 vector, Chromium real Web Crypto upgrade and second unlock PASS. Existing wrong-PIN/change-PIN/idle-lock tests PASS. This is not real security on a public static page. |

## Commands actually run and observed output

All commands run from the repository root. Browser commands use:

```sh
export LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib"
```

Libraries were extracted using the documented README commands. `npm ci --prefix tests` succeeded; subsequent axe development dependency installation reported `found 0 vulnerabilities`.

### Before editing the app

```text
npm test --prefix tests
75 PASS, 0 FAIL (counted from the runner's JSON records)

npm run test:browser --prefix tests
20 PASS, 0 FAIL (counted from the runner's JSON records)

SDP_PROFILE_LABEL=before node tests/profile.cjs
{"label":"before","homeVisibleMs":2043.5,"mode":"lite","longTasks":4,
 "maxLongTaskMs":1455,"trace":"tests/artifacts/before-trace.json"}
```

### Updated candidate

```text
node tests/check.cjs
node --check: PASS; ES5 syntax: PASS; index.html 375024 / 450000 bytes

node --test tests/upgrade.test.cjs
# tests 68
# pass 68
# fail 0
# skipped 0

npm test --prefix tests
75 PASS, 0 FAIL (runner JSON summary)

node tests/upgrade-browser.cjs
11 PASS, 0 FAIL (runner JSON summary, Chromium with 6× CPU)
```

The new browser suite covers five widths, layout after scrolling, a reduced-height keyboard proxy, exact paste, editable preview, row ordering/deletion, all 200 rows, publishing current edited words, real PBKDF2 login/re-login, synthetic voices, saved snapshot after reload, and axe on Home and unlocked Words/planner. Axe found three issues during development (invalid selection ARIA on buttons, calendar keyboard access, missing Publish select label); these were fixed and the suite rerun successfully.

These regression runs also completed during this turn, before the last accessibility/PIN-fallback refinements:

```text
npm run test:browser --prefix tests
20 PASS, 0 FAIL

npm run test:e2e --prefix tests
58 PASS, 0 FAIL
```

The full E2E exceeded the original 180-second tool wait; it was not duplicated. Its background Node process subsequently finished and wrote all 58 records. Coverage includes full 30-word synthetic-voice dictation, results, Community status/comment, old-build storage, wrong/default PIN, session number/day, reload/resume, zero page/console errors, private synthetic-message isolation and offline file boot. It uses Chromium at 4× CPU, not WebKit or physical phones. CI also runs it on the final pushed candidate.

```text
SDP_PROFILE_LABEL=after node tests/profile.cjs
{"label":"after","homeVisibleMs":1506.3000000000466,"mode":"lite","longTasks":5,
 "maxLongTaskMs":960,"trace":"tests/artifacts/after-trace.json"}
```

### Blocked checks

```text
SDP_BROWSER=webkit node tests/upgrade-browser.cjs
browserType.launch: Executable doesn't exist at
/home/user/.cache/ms-playwright/webkit-2215/pw_run.sh
(exit 1)

curl -I --max-time 15 'https://dictationb1.github.io/?smoke=20261014'
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to dictationb1.github.io:443
```

The sandbox's outbound allowlist excludes the live Pages host and Playwright's browser download hosts. CI is configured to install and run real WebKit. Its completed CI job was inspected via the GitHub API and passed (details below); the configuration alone was not treated as proof. Even a CI WebKit pass does not verify iOS hardware audio, keyboard, phone calls, Silent mode or lock-screen behaviour.

## GitHub CI evidence

Draft PR: https://github.com/dictationb1/dictationb1.github.io/pull/6

The implementation commit `adbb919e06f8107476676ef55a183399357dc8ef` passed:

```text
gh pr checks 6
browsers (chromium)  pass  8m25s
browsers (webkit)    pass  1m30s
test                pass  1m10s
units               pass  14s

gh run view 38510591226 --json headSha,status,conclusion
{"conclusion":"success","headSha":"adbb919e06f8107476676ef55a183399357dc8ef","status":"completed"}
```

Run: https://github.com/dictationb1/dictationb1.github.io/actions/runs/38510591226

The WebKit job's step metadata confirms successful actual-browser installation, test execution and artifact upload. The Chromium job includes the complete historical E2E on the implementation commit. Downloading raw CI logs was blocked by the sandbox's log-storage-host allowlist; no additional remote per-case counts are claimed from unavailable logs.

The tested `index.html` SHA-256 is `99a7ebf8888ead63d9bfacd7105f69c1b6eaa3450a47cc48f7ac5f16232e6395` (375024 bytes). Subsequent cleanup only removes default-PIN literals from historical documentation/test fixtures and adds this evidence; the application file is unchanged. The test helper recovers the public four-digit verifier at test time, demonstrating why it is not a security boundary, without committing the PIN text. Git history is not rewritten, and a previously public default cannot be made secret by this cleanup.

Local checks were rerun after fixture cleanup: 75 existing unit/mock records, 68 Node tests, and 11 new Chromium checks passed. Any new CI run on the cleanup commit must be checked separately; the above output identifies exactly which commit was observed green.

## Performance: interpret cautiously

The trace harness uses a 360×640 Chromium viewport at 6× CPU, opens Home/admin, pastes 200 words and scrolls. It records Chrome tracing and PerformanceObserver long tasks. The original comma bug detected far fewer items; the revised preview does substantially more useful work. Both measurements auto-selected Lite. These are single laboratory samples, not statistically controlled device benchmarks.

Home-visible proxy improved from 2,043.5 ms to 1,506.3 ms, and the maximum observed task from 1,455 to 960 ms, but task count increased 4 → 5. **Home visible is not first interactive.** There was no throttled-4G network run, no measured playback-only long-task budget, and no frame-by-frame 200-row scrolling budget. Do not mark the requested <2 s FTI or <50 ms playback budgets as passed. Raw traces/logs are ignored local artifacts, not shipped app assets.

## Remaining Phase 1 release blockers

- Full requested Session/class scheduling: automatic after-class session increment, lecturer timezone, Tuesday/Wednesday default schedule, cancelled/extra dates, a proper “No class” override and Next class countdown. Existing manual session/day and planner continue to work, but are not equivalent to these requirements.
- Full published version history and Undo, complete four-step Words workflow, and a test for every admin flow (including print/exports). Existing draft Undo and session history are not being misrepresented as published version control.
- Hot-load Update choice, list-version comparison with Finish old / Start new, and MediaSession controls. Existing running-session pending-state and resume mechanisms are retained, not a complete implementation of the new specification.
- No-UK voice main audio action awaits the real Phase 2 implementation; no misleading nonfunctional audio button was added.
- Required fake-cloud two-browser publish visibility within 60 seconds has not been added. No actual remote cloud was exercised.
- Physical-device verification (including the actual iOS keyboard/audio policies), complete accessibility audit beyond the tested screens, and performance budgets. Automated WebKit now has a green CI run, but does not replace these checks.
- Live Pages deploy and smoke test. No merge/deploy has been attempted, so no rollback was needed.

**Release decision: leave the Phase 1 PR in draft. Do not merge even if its currently implemented CI tests turn green.** Finish the missing requirements and test coverage first; then squash-merge only with green checks and an available live smoke/rollback path. Start Phase 2 only after that merge and smoke pass. Phase 3 Worker setup and Phase 4 extras are intentionally not claimed.

## Fifteen-minute real-device checklist

Use synthetic class data. Back up first; do not clear actual student work. Test this candidate from a trusted HTTPS preview, not the unchanged production site. Record device, OS/browser versions, result and any error.

### iPhone — 5 minutes

1. Portrait and landscape: Home/Settings fit the safe area. Unlock; scroll the admin panel; open the keyboard on a preview cell. Status and tabs must not overlap. Check SE-size and large-screen devices when available.
2. Paste `tests/fixtures/paste-30.txt`: expect “30 words”, zero duplicates/problems. Edit one phrase; use Up/Down and Delete. Select a Tuesday/Wednesday date; confirm Publish describes the edited count and Session. Do not expect cross-device delivery in Local mode.
3. Start, hear the ready greeting, tap I'm ready. Expect 3–2–1, Number 1, word, pause, word, no example. Confirm audible UK accent and volume (synthetic tests cannot do this).
4. Pause; switch apps or receive a call; return and resume. Reload midway and check saved position/answers. Lock-screen/Silent-mode behaviour must be recorded, not assumed.
5. Check the no-UK voice Text mode route where possible. It must show words without US speech. UK audio fallback is a known unfinished requirement.

### Low-end Android — 5 minutes

1. Paste 200 synthetic words, verify all 200 preview rows, scroll/edit last row; watch for stutters. Check Lite removes decorative effects. Compare Auto and manual Lite.
2. Select/install an English (UK) voice; Start and verify the two repetitions and adjustable writing gap. Pause/Repeat/Previous/Next should respond without double playback.
3. Airplane mode: reload the **downloaded HTML file** and continue from the saved snapshot in the same storage context. Offline HTTPS reload is not claimed yet (no new service worker).
4. Complete a short list and submit a synthetic Finished comment. In Local mode it must remain local; no false remote-success claim. Export a personal backup to a private file.

### Windows PC — 5 minutes

1. Paste comma lists, tab/Excel rows and headed CSV. Check columns/meanings, edit/reorder via keyboard and mouse drag. Publish with a clear confirmation; verify chosen date and session persist after reload.
2. Wrong PIN five times: clear lockout message, no admin access. Use a separate clean test profile to test correct PIN, Lock now, Change PIN and reload. Do not alter the lecturer's real PIN for QA.
3. Add a UK voice through Windows speech settings and restart the browser. Check no US fallback on a separate no-UK profile.
4. Review sample results/Community, moderation/private inbox isolation and worksheet/print preview. Export/import a synthetic backup and check lists/results survive. Record failures for the remaining admin audit.

The five-minute lockout/long idle timers and multiple physical iPhone sizes may require follow-up beyond these fifteen minutes. Do not speed up the device clock on a lecturer's production profile.

## v43 — bundled single-voice audio pack (2026-10-28)

| Gate | Result | Evidence |
| --- | --- | --- |
| One identical neural voice for 100% of speech | PASS | All 134 MP3s in `./audio/` are rendered by one engine (`en-GB-SoniaNeural` via `edge-tts`, or the bundled Supertonic model through `scripts/tts_offline.py`); no device `speechSynthesis` clip is part of the pack. |
| Every required clip exists and is playable | PASS | `welcome-paper`, `welcome-type`, `sound-check`, `count-3/2/1`, `countdown-321`, `paused`, `finish-paper`, `finish-type`, `num-1..30`, `resume-1..30` and `word-<slug>` for all 30 session words — 134 files, each > 1000 bytes, served from the same origin. |
| Pack stays out of the media cache | PASS | `LiveWallpaper.isAssetsMedia("./audio/word-bicycle.mp3") === false`; `./audio/` is never treated as a `./assets/` media file, so `sdp.gh_assets_v43` keeps only the bunny video. |
| Pass 1 is one atomic clip per word | PASS | `TTS.resolveClips` maps "Number 1, guidebook" to `./audio/pass1-1-guidebook.mp3`; custom user words still fall back to `REMOTE_FALLBACK_BASE` (Youdao). |
| Lockstep 3-2-1 hands over to word 1 | PASS | `count-3` at 0 ms, `count-2` at ~950 ms, `count-1` at ~1900 ms and `pass1-1-*` at ~2850 ms measured in the Chromium audit. |
| No robotic fallback, no console errors | PASS | 4000 ms watchdog with `load()`/`play()` retry; the audit records 0 `speechSynthesis` utterances, 0 console errors and 0 page errors, and a missing clip resolves `false` cleanly instead of speaking. |
| Size and syntax budget | PASS | `441,018 / 450,000` bytes, strict ES5 (`var`/`function` only), zero external `<link>` or external `<script src>`. |
