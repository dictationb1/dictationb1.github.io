# v2 draft release gate — 2026-10-14

**Do not merge or deploy.** Work remains on the Arena session branch; main is unchanged.
The backup-before-v2 tag points to the original main commit. No other working branch was created.

## Executed checks

One initial run, followed by one fix-and-retest cycle, as requested.
- `node tests/check.cjs`: node syntax and Acorn ES5 syntax PASS; index.html is 379,931 bytes. This exceeds the requested 300 KB initial-load target.
- Initial Playwright run: all 32 cases failed to launch. Chromium lacked libnspr4; WebKit executable is absent.
- Retest used the Chromium libraries bundled in the npm development dependency, with `LD_LIBRARY_PATH=/tmp/al2023/lib` and `SDP_BROWSER_BIN=/tmp/chromium`.
- Chromium 390x844 and 360x640: **10 passed, 4 failed, 2 skipped**.
- Passing: boot without page errors; visible build; thirty-word static session; default repeats/sentence; eight paste formats; supplied past-session words; stale-version banner; newer static-cache guard; bounded idle rAF; no horizontal page overflow in light/dark. Lite/light/dark screenshots saved locally, not committed.
- Failing: Start stays idle with zero voices or US-only voices at both sizes. These are real unresolved MUST failures, not expected-pass assertions.
- Skipped: environment LECTURER_PIN was not supplied. No PIN was recovered or written into test fixtures.
- WebKit, real iPhone audio, full thirty-word dictation, complete cloud/offline outbox, CPU throttle, contrast, overlap/clipping and full regression suite were NOT verified.
- No merge, Pages deployment, post-deploy fetch or rollback was performed because the merge gate failed.

## Changes implemented (not a complete release)

Tolerant mixed paste parser; thirty authored starter definitions/examples; settingsRev migration; supplied-word practice fix; past-session publish upsert; keyboard/Enter/known-length keypad submission; bounded frame sampling; weak-device Lite thresholds; debounced typing persistence; backup throttling and dictionary cache count cap; slower polling paused during sessions; static config/session loading and reload banner; non-cloud status no longer counts waiting jobs.

## Exact remaining MUST work

1. **A1 first:** vendor offline UK eSpeak with GPL licence; implement unified per-session device/recording/offline choice, all-word recording preload timeout, shared gesture-unlocked audio, fixed-phrase fallback, Ready engine/test sound, Settings and Dictionary integration, remove all strict gates and blocking NoVoice UI. Current Start still blocks without UK device speech.
2. **A2:** replace textarea truth with the four-step editable-table workflow; remove duplicate reorder controls; automatic bounded/cached lookup with browser CORS validation and attribution; next-class buttons; publish/readback student check; publish Undo; contact consolidation; tab persistence; session JSON download; verify all touch targets and narrow panels. PIN changes and existing draft Undo remain unverified.
3. **A3:** verify migration on existing devices and all published default paths, including cloud speed and paper mode; optional sentence/repeat-sentence switches need verification.
4. **A4:** wire configurable Tue/Wed class days throughout planner/tools/settings; eight class dates; next-date publishing and increment; today's/latest source selection; editable labels reaching every student. Config file currently stores days but does not implement this full calendar.
5. **A5:** cloud-first/cached publication ordering across reloads is incomplete; static session currently pins latest rather than selecting class date. Implement cver in Apps Script, conditional comment pulls, backoff/dedupe audit, state invalidation on publish, readback confirmation, lecturer setup card and exact config-copy action. Cloud endpoint was not supplied. Validate minBuild and config inputs more strictly. Retain correct cache fallback when cloud is newer.
6. **A6:** anonymous automatic completions and consent, early-exit prompt, counts, refresh-on-open, queued dedupe and private follow-up still required; verify moderation/private separation.
7. **A7:** paper scoring-before-send/idempotent correction/averages remains unfixed; snapshot still copies settings per keystroke; cache cap is insertion order, not LRU; quota prune/retry remains; verify per-word writes and stored-session Dictionary selection.
8. **A8:** under-300 KB load, blur restrictions, no continuous CSS animation, dictation task timings, contrast, chunking and every narrow-layout/tier/accessibility requirement remain unverified or unfinished.
9. **Acceptance:** expand smoke.spec.js to the full required scenarios, provide LECTURER_PIN through environment, run WebKit and Chromium, test real iOS interruptions/audio, existing exports/restore/print/diagnostics/resume and server behavior. Mixed CSV multiline quoted fields need regression coverage; column convention is word/meaning/sentence without a header, and explicit headers map either order.

## SHOULD and LATER

GitHub mirror/token controls, verify.yml CI, first-letter hint, duplicate-class/QR/counter are TODO. README is a short draft owner guide, not evidence of finished workflows. Later: network-first PWA, licensed Piper generation, Cambridge permission.
