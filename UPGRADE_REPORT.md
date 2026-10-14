# Upgrade progress — not a v2 release

## Phase 0: baseline

- Base: `427bedd6cde077007fbc6792863544095bebc2c8`.
- Local safety tag: `v1.4.0-before-upgrade`. No tag has been pushed.
- Work stays on `arena/d0de1e09-dictationb1-github-io` because this Arena session is fixed to that branch.
- The source matches the owner's version: 1.4.0, build 2026-10-13, 361,624 bytes.
- Existing tests were already present. Their older comparison commit became available after fetching the shallow history.
- Test packages are for development only. The app loads none of them.
- The saved-data fixture comes from the unchanged v1.4.0 `defaultData()`. It has a Thursday list, a dark theme and a changed speed. It contains no PIN or real person's data.

Commands run:

```text
npm ci --prefix tests
added 82 packages, and audited 83 packages in 5s
found 0 vulnerabilities

node --check (main and embedded Apps Script), plus acorn ecmaVersion 2017
PASS main: node --check and ES2017 parse
PASS gas: node --check and ES2017 parse

node tests/upgrade.cjs --baseline
FAIL B1: six-line paste reads 28 words without invented fields: 6 == 28
FAIL B2: lecturer tabs and unlocked banner do not stick over each other: admintabs must scroll normally
FAIL B6: default is two readings, no sentence, numbers, rate and pause kept: true == false
FAIL B6: saved v1.4.0 migration keeps settings and Thursday list: true == false
FAIL B7: expired override cannot hide the scheduled list: 'override' == 'list_sample_b1'
FAIL B5: shared admin check counts wrong attempts, not just login: wrong attempts did not start a lockout
Upgrade regression tests: 0 passed, 6 failed.
Exit: 1 (expected before fixes).
```

B5 belongs to phase 3. Keep its failing test available with `node tests/upgrade.cjs --security`; do not treat a phase 1 test run as evidence for server security.

## Phase 1: completed; later phases not started

**This is a draft pull request, not the finished v2 upgrade. Do not merge it as v2.**
I stopped at the phase-1 boundary rather than ship part of a new backend. There
is one PR for this work; later phases should continue in that same PR.

The app is still one standalone file, with the same storage key and no new
runtime packages. It is 369,873 bytes. The version stays **1.4.0** until the v2
requirements are finished. The build date is **2026-10-14**. A comment in the
source identifies the phase-1 changes.

### What changed

- Commas and semicolons now keep all words. Phrases stay together. The preview
  gives read, word, duplicate and skipped counts. Every duplicate or skipped
  item has a reason. The list limit is 200; existing saved lists are not cut
  down to that size. Blank lines and trailing empty cells are ignored.
- `torch, flashlight` stays two words. Tap **Treat as word, meaning** to change
  that line. Tap **Undo** to reverse it. Old hints disappear as soon as typing
  changes the text, so a delayed preview cannot edit the wrong line.
- A malformed row with extra columns is shown as skipped, with the complete
  row and a reason. Long sentence/meaning fields are not silently shortened.
- The lecturer header stays above the scrolling content. Notices and tabs do
  not stick over the editor. The tabs are **Words · Session · Inbox · More**.
  **More** opens Comments, Class stats, and Settings & tools.
- The textarea is proportional text, at least 16 px, and 45% of screen height.
  The existing draft autosave remains. Buttons now say **Use these words** and
  **Add to list**. The new three-step publishing screen is NOT included.
- New settings use two readings, no sentence, numbers on, speed 0.85 and a
  1.2-second word pause. Both sentence switches now record a deliberate choice.
- Old, untracked sentence settings reset to off once. Other settings and the
  saved Thursday list remain. An existing tracked choice stays unchanged.
- **Override for today only** has a saved date. It appears on Home and in the
  lecturer panel, stops affecting future dates, and expires at local midnight.
  An open page refreshes the banners at midnight and after returning to it.
  The override date survives the existing cloud plan format. Old-server polls
  do not keep extending it.
- As a safety fix, no built-in PIN is created by load, reset or import. A new
  local user reaches the existing Create/Confirm screens. Existing hashes stay
  intact. The old value was removed from current tests and historical reports;
  tests use random throwaway values. Server authentication is **still unsafe**
  and is not fixed by these local changes.

### Evidence from this sandbox

```text
npm run test:upgrade --prefix tests
PASS main: node --check and ES2017 parse
PASS gas: node --check and ES2017 parse
PASS app size: 369873 bytes; sdp.v1 unchanged; no HTML-string injection or eval
PASS old seed value and GitHub token pattern scan: 17 tracked text files; values not printed
Upgrade regression tests: 11 passed, 0 failed.
5000-line parser maximum: 9.43 ms
Parser tests: 13 passed, 0 failed.
```

The parser test includes 1,000 randomised inputs and checks
`read = words + duplicates + skipped`. The timing is ten runs after warm-up on
this Node host, not a real phone speed claim. The file count above was before
adding the new test files to Git; the final scan is recorded below.

```text
npm test --prefix tests
Existing unit/server tests: 76 passed; 0 failed.

LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib" npm run test:browser --prefix tests
Existing Chromium suite: 20 passed; 0 failed.

LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib" npm run test:upgrade-browser --prefix tests
PASS Chromium 320 px / dark / XL: four tabs, no header overlap or sideways clipping, paste 28, meaning hint + Undo, More, Lock, zero console errors
PASS Chromium 360 px / dark / XL: four tabs, no header overlap or sideways clipping, paste 28, meaning hint + Undo, More, Lock, zero console errors
PASS Chromium 390 px / dark / XL: four tabs, no header overlap or sideways clipping, paste 28, meaning hint + Undo, More, Lock, zero console errors
PASS Chromium 430 px / dark / XL: four tabs, no header overlap or sideways clipping, paste 28, meaning hint + Undo, More, Lock, zero console errors
PASS Chromium 768 px / dark / XL: four tabs, no header overlap or sideways clipping, paste 28, meaning hint + Undo, More, Lock, zero console errors
Upgrade browser matrix: 10 passed, 0 failed. Chromium only, not iPhone Safari.

LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib" npm run test:e2e --prefix tests
Existing Chromium end-to-end suite: 58 passed; 0 failed.

 git diff --check
PASS git diff --check
```

The end-to-end run exceeded the first tool's wait limit. It kept running; it
was not started a second time. Its final log contains the 58 passing checks.
Those tests cover mocked UK speech, full dictation, saved progress and reload,
comments, private messages and zero page/console errors, including old storage
and 4x CPU throttling. The offline check opens a local file. It does **not**
prove offline reload of the hosted website. Fast-3G startup is NOT VERIFIED.

This expected failure remains visible, separate from the phase-1 checks:

```text
npm run test:pending-security --prefix tests
FAIL B5: shared admin check counts wrong attempts, not just login: wrong attempts did not start a lockout
Upgrade regression tests: 0 passed, 1 failed.
Exit: 1.
```

### Full request status

DONE-VERIFIED means verified in the named automated test, not on a real iPhone.
NOT DONE includes partial work where the whole requirement is not finished.

| ID | Status | Evidence or work still needed |
|---|---|---|
| B1 | DONE-VERIFIED | 28-word case, 13 parser tests, random accounting, browser paste |
| B2 | DONE-VERIFIED | Ten Chromium layout cases; one fixed header; four tabs |
| B3 | NOT DONE | No shared config or GitHub save path yet |
| B4 | NOT DONE | Local seed/create fixes pass; the server-only session design is still missing |
| B5 | NOT DONE | The shared-authentication regression still fails |
| B6 | DONE-VERIFIED | Defaults, saved-data migration, both switches and audio-beat tests |
| B7 | DONE-VERIFIED | Dated resolution, banners, midnight refresh and cloud expiry-row tests |
| B8 | NOT DONE | Plain labels and larger editor done; new publishing flow and history missing |
| B9 | NOT DONE | Automatic enrichment not added |
| B10 | NOT DONE | Seven-day planner remains; no classDays setting yet |
| B11 | NOT DONE | No service worker, manifest or real icons yet |
| B12 | NOT DONE | New completion-to-Community sheet not added |
| R1 | DONE-VERIFIED | Parser and browser suites above |
| R2 | NOT DONE | Layout fixed; this-week card, wizard, ten versions and class-day controls missing |
| R3 | NOT DONE | Lexicon, automatic enrichment, validators and templates missing |
| R4 | NOT DONE | Dated override done; class days, server time and new session controls missing |
| R5 | NOT DONE | Gatekeeper/GitHub path, config, health checks, mock convergence and SETUP.md missing |
| R6 | NOT DONE | Local fixes and random tests done; server tokens/lockout/POST-only reads missing |
| R7 | NOT DONE | Defaults and migration done; the complete new student/default-control flow is not delivered |
| R8 | NOT DONE | Existing UK speech tests pass; requested new voice-help flow not delivered |
| R9 | NOT DONE | Hosted offline/install/update/exactly-once test not delivered |
| R10 | NOT DONE | New completion sheet and counts not delivered |
| R11 | NOT DONE | ES2017/size/layout checks pass; full device/performance/style audit still needed |
| Extras | NOT DONE | No new optional extras added |

### Assumptions and limits

1. v1.4.0 never recorded whether the sentence switch had been touched. That
   history cannot be recovered. An untracked `true` resets once; users can turn
   it on again. A recorded `sentenceTouched` choice is kept.
2. A legacy permanent override keeps its saved list and gets today as its
   expiry date on first migration. It is not allowed to block tomorrow.
3. Dates use the phone's local clock in this phase. Server time, time-zone
   differences, and Tuesday/Wednesday scheduling remain phase-2/3 work.
4. A paragraph without separators stays one phrase, as rule (c) requests.
   The parser does not guess where multi-word phrases end. A phrase above the
   existing 40-character word limit is visibly skipped, not cut short.
5. Blank lines are not errors. A CSV header is not counted as a word. A
   malformed structured row counts as one skipped item, with the whole row
   shown. Extra columns are never discarded without a warning.
6. The historical reports are kept as history, with the old credential value
   removed. They are not evidence that the new v2 requirements have been met.
7. The static scan checks the old seed and GitHub token patterns. It is not a
   full secret audit or host allowlist audit. Existing link-out hosts are not
   changed in this phase.

### Your to-do list — preview only, about 10 minutes

Use the live preview, not the public Pages site. Keep the PR as **Draft**.
Real iPhone Safari and low-end Android speech are **NOT VERIFIED** here.
Each numbered check below should take about one minute. Repeat the sound and
layout checks on both phones if you have both nearby.

1. Open the preview. Tap **Lecturer mode** (the lock button). On a fresh phone,
   create your own PIN, then enter it again. Do not send it in chat. Check that
   the screen says this PIN protects this phone only.
2. In **Words**, paste the six lines from your task. Check for **28 items read →
   28 words · 0 duplicates removed · 0 skipped**. Check that hobbies has no
   sentence/meaning and that go shopping is one item.
3. Replace the text with `torch, flashlight`. Tap **Treat as word, meaning**.
   Check that flashlight becomes the meaning. Tap **Undo** and check that both
   words return. This is also a quick Safari clipboard/typing check.
4. Set the phone to large text, then scroll the lecturer screen. Check that
   **New list** is reachable and the four tabs do not overlap. Try dark mode
   and turn the phone sideways. These real-device layouts are NOT VERIFIED.
5. Tap **Lock**, open app **Settings**, and check that **Read the example
   sentence** is off. Turn it on, reload, and check it stays on. Turn it off
   again. Your chosen setting should now survive reloads.
6. Open lecturer mode. Find **Override for today only** in Words and choose a
   published list. Check for the banner there and on Home. Reload and check
   that the banner remains for today. Tomorrow it should be gone; the exact
   midnight phone behaviour is NOT VERIFIED on a physical device.
7. For a short sound check, use the editor to replace a test list with `torch`
   and `picnic`, then publish for Today **on this phone only**. Lock the panel.
   In **Settings**, tap **Test voice**. Return Home, then tap **Start** and **I'm ready**. Check for UK speech,
   each word twice, and no example sentence. Try Pause/Resume. Real voices,
   audio unlock, calls and Siri are NOT VERIFIED. This one-minute check covers
   the basic sound flow; interruptions need a separate real call/Siri test.
8. Start that short list again. After the first word, reload and use Continue.
   Finish, then use the existing Share control. The new automatic completion
   sheet is not present. Hosted offline reload and second-phone sync cannot
   be approved in this phase; those features are NOT DONE.

**Apps Script, token, ADMIN_PIN, time zone and config.json:** do not set these
up from this draft as a v2 release. The secure backend and its click-by-click
SETUP.md still need to be built. Keep real tokens out of the browser, repo,
PR and chat. When that phase is ready, choose a new 6–8 digit server PIN.

**Merge:** do not click Merge now. A maintainer must finish phases 2–5, make
all required checks pass, complete the real-device checks, and update this
report before the PR is ready. The public site has not been updated by this
branch. Version 2.0.0 on Pages is NOT VERIFIED and is not expected yet.

### PIN history reminder

Any PIN ever committed to this public repository stays readable in Git
history, even after removing it from the latest files. Choose a **new** PIN.
An existing local hash is intentionally preserved so saved data is not lost.

### Rollback

- Before merge: on GitHub, open this draft PR and click **Close pull request**.
  The public site stays unchanged. Keep a downloaded data backup from the app.
- If this PR is merged later: open the merged PR, click **Revert**, then
  **Create pull request**. Check that revert PR and merge it. This reverses
  the code change; it does not restore earlier phone settings.
- The original source is at base commit
  `427bedd6cde077007fbc6792863544095bebc2c8`. A local safety tag also points to it.
  Restoring that version also restores its known bugs and old PIN design.
- To restore phone data, use the app's **Settings → My data → Restore from backup** with
  a backup made before testing. Check the backup before replacing phone data.


### Final local scan before the phase-1 commit

```text
npm run test:upgrade --prefix tests
PASS main: node --check and ES2017 parse
PASS gas: node --check and ES2017 parse
PASS app size: 369873 bytes; sdp.v1 unchanged; no HTML-string injection or eval
PASS old seed value and GitHub token pattern scan: 21 tracked text files; values not printed
Upgrade regression tests: 11 passed, 0 failed.
5000-line parser maximum: 8.78 ms
Parser tests: 13 passed, 0 failed.
```
