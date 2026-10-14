# Smart Dictation Player v2.0.0 — incomplete candidate, DO NOT MERGE

Build: 2026-10-14. Data schema: 2. Storage key: `sdp.v1`.
App: `index.html`, the only root HTML containing Smart Dictation Player.
Rollback: existing annotated remote tag `v1.4.0-before-v2` resolves to
`427bedd6cde077007fbc6792863544095bebc2c8`, the main commit at the start.
Work stays on the Arena session branch; main has not been changed.

## Release decision

**NOT READY. No merge.** The requested upgrade is not complete. T14 fails by
execution because the guided Saturday+Sunday flow is missing. T26 fails because
Run self-test is missing. Several other acceptance scenarios are only partly
covered and must not be represented as fully passed. The default test command
intentionally fails on the unmet acceptance checks; no failing check is suppressed.

## What changed

1. Additive schema-2 migration: two repeats, sentence off once; class defaults separated.
2. Precomputed local salted PIN hash; no plaintext configured PIN in the working tree.
3. Automatic cloud sync after paint; personal touched settings and lecturer drafts retained.
4. Publish parses the current editor, not old saved words; progress is not called live until acknowledged.
5. Required Ready sheet, spoken prompt/go/countdown, UK-only voice rescan, cancellation and stale callback guards.
6. Past-session practice uses archived words and hides future dates; early finish excludes undictated words.
7. Per-word paper marks, unscored initial state, live score/mistakes and one-time final result sends.
8. Recoverable storage retry/previous-version backup; independent queue retries; personal RESET without lecturer unlock.
9. Random cloud session tokens, escalating PIN-check throttling, POST-only private reads, filtered public state and stable result IDs.
10. Anonymous finished auto-posts, private reply retrieval, cloud class summaries and development-only executable regression suites.

## Defect → fix and reproduction map

All baseline checks execute the original `427bedd:index.html`, not copied assertions.
Evidence: `qa/v2/defects-before.json`, `defects-after.json`, `server-before.json`, `server-after.json`.
A PASS below is a targeted regression, not blanket completion of its entire requirement.

| Defect | Reproduced by execution | Candidate result / remaining work |
|---|---|---|
| D1 | Yes: no boot state request | PASS: request without tap; two contexts observe publish |
| D2 | Yes: confirmation uses old count | PASS: parses and publishes unsaved preview words |
| D3 | Yes: sync changes personal settings/drafts | PASS: touched map/version and separate live fields; UI flows need fuller coverage |
| D4 | Yes: sentence true on new device | PASS: false/two defaults, one-time migration and separate class-default object |
| D5 | Yes: future archive visible | PASS: dates filtered and archived words passed as list |
| D6 | Yes: paper zero sent immediately | PASS: null score, per-word marks, one finalisation; reload-to-mark UI still needed |
| D7 | Yes: old beats survive Start | PASS: reset beats, protected sheet, one Escape owner; tour cannot replace Ready |
| D8 | Yes: direct PIN admin actions bypass lockout | PASS: all PIN checks share throttle; tokens survive attacker lockout; GET private reads removed |
| D9 | Yes: early finish records 30 words | PASS: records only positions whose word beat began |
| D10 | Yes: runItem does not cancel | PASS: cancellation at item/utterance boundaries |
| D11 | Yes: sender sees unread badge | PASS: badge uses lecturer messages or new private replies |
| D12 | Yes: lock prevents queued admin send | PASS for token lifetime/acknowledgement; pin precedence still needs blocking resolution in guided planner |
| D13 | Yes: quota permanently blocks; backup equals current | PASS for retry/rolling previous version; full cache trimming remains incomplete |
| D14 | Yes: first failed job blocks next | PASS: each item attempted independently with retry delay |
| D15 | Yes: dictionary misses arbitrary word; no personal reset | PASS: search on every tab and personal RESET preserves lecturer lists |
| D16 | Yes: public state contains future list; count-only class UI | PASS for distinct future list withholding and class breakdown; same-list scheduled revisions require further work |

## Acceptance status — full requested test, not only a passing subset

PASS means the stated automated scenario was executed. No iPhone/Safari or Android
hardware has been used. Speech is mocked, so audible speech and interruption by real
calls/Siri remain device checks. NOT RUN can include a passing subset: see the last column.

| ID | Status | Evidence / scope |
|---|---|---|
| T1 | PASS | Chromium fresh install: 30 words, schema 2, requested basic defaults |
| T2 | PASS | v1 fixture migrated; subsequent personal changes survive reload and sync |
| T3 | PASS | Chromium shown/spoken Ready, scrim/Escape ignored, go/countdown before word 1 |
| T4 | PASS | Chromium exact first three number/word/word beats; every mocked utterance en-GB |
| T5 | NOT RUN | Pause/resume/prev/next executed; exhaustive controls, spell/slower/restart not covered together |
| T6 | NOT RUN | Snapshot reload/resume executed in VM; real calls/Siri/lock not available |
| T7 | PASS | Early finish records only one dictated word; future mistakes excluded |
| T8 | NOT RUN | Chromium marks/ring/mistakes/Done idempotence pass; full 10-minute reload flow not executed |
| T9 | PASS | Typed correct/wrong/US-half scoring and diff DOM executed |
| T10 | PASS | Past words played, future archives hidden in DOM regression |
| T11 | PASS | Chromium US-only: zero speech; Text mode explicitly labelled |
| T12 | PASS | Chromium voices appear after five seconds; subsequent Start works without reload |
| T13 | NOT RUN | Configured PIN, wrong-attempt lock and idle lock pass; visible lockout countdown still missing |
| T14 | FAIL | Executed: Saturday+Sunday publish option is absent; full guided planner incomplete |
| T15 | NOT RUN | Date-entry metadata resolves/starts correctly in VM; editing/propagation UI incomplete |
| T16 | NOT RUN | Two-context publish while locked reaches student without tap; preservation unit passes; strict <=20 s not guaranteed by current jitter |
| T17 | NOT RUN | Anonymous auto-post/dedupe and separate manual limit executed; full moderation/privacy/opt-in score flow not covered |
| T18 | NOT RUN | HTTP message isolation and Unicode plus server secret-id reply pass; end-to-end reply UI coverage incomplete |
| T19 | NOT RUN | Offline saves/retry isolation executed in VM; full browser airplane-mode/reconnect matrix incomplete |
| T20 | NOT RUN | 320/375/430/768/1440 main screens at 4x, S-XL, light/dark/HC/Lite pass overflow checks; player/admin/all controls/6x incomplete |
| T21 | PASS | Quota retry, throttled previous backup and corrupt-primary restore executed |
| T22 | NOT RUN | No full contrast audit or keyboard-only/reduced-motion acceptance run |
| T23 | NOT RUN | Arbitrary search/cache/UK-source restrictions pass; real online dictionary and full link/audio flow not executed |
| T24 | PASS | Literal malicious text, formula-safe CSV, throttled admin brute force and token tests executed |
| T25 | PASS | Sinhala/Tamil/emoji through HTTP mock private messages and public text |
| T26 | FAIL | Executed: full Run self-test action absent; P1 deferred |
| T27 | PASS | Build stamp in Settings (Chromium), diagnostics and fatal card (VM) |
| T28 | PASS | Existing lists/history/comments/inbox/outbox/snapshot retained by schema migration fixture |
| T29 | PASS | Eight local Apps Script/HTTP checks green; not proof of Google deployment/runtime |

## Execution details and static audit

- `npm ci --prefix tests`: completed, audit reported zero dependency vulnerabilities.
- `SDP_TEST_PIN=<PIN> npm test --prefix tests`: ES2017/inventory, 18 client regressions,
  eight server checks pass; acceptance gate exits 1 for T14/T26.
- `LD_LIBRARY_PATH=... SDP_TEST_PIN=<PIN> node tests/browser-v2.cjs`: Chromium execution;
  first runs exposed test timing assumptions, corrected to wait for the existing
  90 ms speech and 250 ms result-display delays. The latest run passes 13 scenarios.
- Console/pageerror capture reported no errors or warnings in the single-context
  browser scenarios and the final two-context cloud flow.
- Firefox/WebKit launch attempted: executables absent. Their download hosts are not
  in the sandbox's outbound allowlist. Both suites NOT RUN.
- The historical `test:legacy` failed before executing because `7577968` is absent
  from this repository. Old contracts are retained for reference, not substituted
  as v2 proof. CI now runs the v2 gate; it must not be green yet.
- All inline scripts (including Apps Script) parsed with Acorn ES2017. Banned
  syntax/inline handler/eval/Function audit executed. No `innerHTML` in the app.
- Network constants/read-only audit: dictionary API, Apps Script, Cambridge link;
  audio restricted to UK-named files on dictionary API host; contact inputs validated.
  Google and dictionary live calls were not executed due sandbox host restrictions.
- Function inventories: `qa/v2/function-inventory.json`. No original top-level feature
  function removed. The local nested `Results.saveSelf` stepper helper was deliberately
  replaced by `Results.mark` and `Results.finalise`.
- The file grew, not shrank, and remains below 450 KB. Exact byte counts in inventory.
- Plaintext PIN removed from current app/test/docs; historical Git commits are not
  rewritten. Existing public history still contains the old insecure default.

## Known incomplete work / self-review blockers

Do not merge until these are implemented and tested, in addition to completing the
NOT RUN rows above:

- Full date planner: next-class/weekend/multi-date calendar, conflicts with one-tap
  unpin, weekend copying, last-five-version Revert and date-scoped session editor.
  Publishing another revision of an already active list for a future date can still
  affect today's live words. Never schedule future words with that flow yet.
- Five-tile lecturer home, visible countdown, complete per-date labels/next-class
  home UI, current rule explanation, and exact <=20 s freshness timing.
- Ready phrase expansion for *existing customised pools* is not forced (new devices
  have 15/8); default pool migration policy needs review. Text mode early-finish word
  accounting and speech watchdog interruptions need more checks on hardware.
- Reload-to-mark paper results, 10-session backup offers, final self-score post opt-in,
  optional problem-on-exit flow, and full private-message UX need completion.
- All UI strings have not been centralised in S; legacy English/UI/a11y styling
  requirements need a complete pass. No contrast 4.5:1 claim or <=2 s claim is made.
- P1 self-test, cache trimming and optional snapshot workflow; P2 themed drafts/lens
  deliberately not added while the P0 release gate is red.
- A static local PIN is a convenience lock, not security against DevTools or offline
  guessing of a four-digit hash. Cloud tokens protect server writes; a PIN attacker
  can still delay a *new* login via the shared PIN-check budget, but cannot invalidate
  a lecturer's existing token. CacheService quotas/eviction need live evaluation.
- No Cambridge recording is embedded, proxied or claimed. Voices depend on device
  installation. Live Google deployment, timezone/DST and redirects need manual tests.

## Decisions and lecturer setup (after the release gate is green)

No supplied /exec link: `var CLOUD_URL = "";` remains local mode. An older valid saved
link is retained only while the source constant is empty; a nonempty constant takes
precedence. This preserves existing devices rather than deleting their configuration.
No final release was deployed, so do not apply this script to a production class yet.

1. Create a new Google Sheet.
2. Open Extensions > Apps Script.
3. Paste the complete code inside `<script type="text/plain" id="gas-source">` from
   `index.html` (exclude the script tags), or use the lecturer Copy script button.
4. Project settings: set the time zone; Script properties: ADMIN_PIN = the lecturer
   PIN supplied in the request. Do not commit the PIN.
5. Deploy > New deployment > Web app; Execute as: Me; Access: Anyone; authorise.
6. Copy the URL ending `/exec`.
7. Edit exactly `var CLOUD_URL = "";` in `index.html` to
   `var CLOUD_URL = "YOUR_GOOGLE_APPS_SCRIPT_EXEC_URL";`.
8. After later script changes: Deploy > Manage deployments > New version. Keep the URL.

GitHub Pages is enabled at https://dictationb1.github.io/ with main/root source
(queried through the GitHub API). It still serves main's old release. No post-merge
or live v2 check applies because this candidate is deliberately not merged.

Rollback, if a later deployment needs it: restore `index.html` from the remote tag
`v1.4.0-before-v2` in a new reviewed commit. Never force-push or rewrite history.
