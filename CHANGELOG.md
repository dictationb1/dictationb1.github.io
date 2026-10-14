# Changelog

## 2.0.0 — 2026-10-14 (released to GitHub Pages)

- **Four-tier British audio engine.** A single shared `<audio id="sdpAudio">` element, unlocked inside the first tap, plays recorded Cambridge/Oxford UK dictionary MP3s, then the device `en-GB` voice, then a streamed cloud British TTS voice, then any installed English voice plus a WebAudio chime. The "No UK English voice found" sheet can no longer block `Eng.start` or `Speech.say`, and a missing device voice never drops a phone into silent Text mode. The Ready sheet and Settings → Voice both show a `UK Audio Ready` pill and a **Test sound** button, and the greeting is always spoken.
- **Default list is the 30 Cambridge B1 "Leisure & Hobbies" words** (`hobbies` … `torch`), each pre-filled with a B1 meaning, a B1 example sentence and a UK MP3 URL; the same list is published as `data/session.json`.
- **Automatic meaning & sentence generator** in `Admin.parseWords`: built-in B1 bank first (30 leisure + previous sample + common B1 words), then a background dictionary lookup, then a clean B1 template, so `s`/`m` are never blank and no separate enrich button is needed.
- **Streamlined Admin editor** on four steps (paste → review → session & class day → one-tap **Save & Publish to All Students**), a live "30 words ready — meanings & sentences auto-filled" badge, and `Admin.saveAll` publishing list + active session + plan + cloud queue + Home at once. Lecturer PIN stays `7898`, supports a physical keyboard (digits, Backspace, Enter) and auto-unlocks as soon as the four digits are in; a cloud login failure still falls back to the device PIN.
- **Dictation defaults** are now `sentence: false`, `repeats: 2`, `rate: 0.85`, `numbers: true`, `mode: "paper"`, with schema 3 and a `settingsRev: 2` migration that also swaps an existing install's sample list for the 30 leisure words and publishes it.
- **Classes are Tuesday and Wednesday only**: the date list returns the next 8 class dates, "Next session" advances Tue/Wed, and the weekly planner highlights the two class days behind a collapsed "Other days" disclosure.
- **Always-on online mode**: `data/version.json`, `data/session.json` and `data/config.json` are fetched with `cache: "no-store"` on boot and on Refresh, cache-busting `<meta>` tags stop stale pages, the status chip reads `Online · Live B1 Session` (never "Local mode" while online), and Settings & Tools gained one-tap **GitHub Direct Publish** plus **Download session.json**.
- **Community auto-completion**: finishing a dictation posts an anonymous `Completed Session X · Score: Y/30 (Z%)` entry (with device metadata) to Community and the sync queue, and it updates live when the paper self-check score changes.
- **Lag removal**: the frame probe samples at most 60 frames once and permanently cancels its `requestAnimationFrame` loop, low-core/low-memory phones start in `lite` with gradient-based "liquid glass" instead of scrolling `backdrop-filter`, the duplicate `.bak` write only happens on session finish or publish, and `dictCache` is capped FIFO at 200 entries.
- **Paper-mode self-check**: the Results screen lists every word with tap-to-mark *Got it right / Missed it* controls that live-update the score ring, `DB.data.history` and the community post.
- `tests/upgrade.test.cjs` covers the whole v2.0.0 surface (88 tests); `tests/phase1.cjs` now skips cleanly when the historical baseline commit is absent from a shallow clone so it cannot block CI.

## 1.5.0-rc.1 — 2026-10-14 (unreleased; partial Phase 1)

- Whole-paste format detection, quote-aware CSV, plain comma/semicolon/bullet lists, ordered case-insensitive de-duplication, and explicit format override.
- Editable full preview, chunked row rendering, deletion, drag ordering and accessible Up/Down alternatives. Counts no longer treat absent optional sentences as problems. Invalid/ambiguous input blocks saving/publishing rather than silently dropping problematic rows.
- Replace/Add draft labels, Tuesday/Wednesday date chips, and Publish confirmation based on the current preview and chosen dates.
- One sticky admin wrapper prevents the status/tab overlap. Labelled Publish selector, keyboard-focusable calendar and corrected segmented-control ARIA.
- Schema 2 migration: default word repetition twice, example sentences off, original stored data retained in an additional recovery key; existing custom preferences survive later reloads.
- Tolerant UK language tags and cautious UK name matching. Explicit non-UK locale tags cannot be overridden by a name. Voice list refresh on first gesture, and stale voices cleared.
- Default PIN verifier precomputed; successful login re-salts and upgrades to PBKDF2 where supported. Existing hashes and fallback preserved. Recovery/security limits documented.
- Greeting on Start, guarded countdown callbacks and repeated taps, minimum four-second writing gap.
- Continuous foreground frame median probe, sticky Auto downgrade, no iPhone core-only downgrade, limited Full-mode blur and stricter Lite rendering.
- Added Node tests, real Chromium/WebKit CI entry points, axe checks, file-size/ES5 syntax budget, and reproducible Chrome trace harness.

Not a completed Phase 1 or a production release. Remaining work and verification limits are tracked in PHASE1_QA.md. No Phase 2 audio assets or Phase 3 Worker/cloud deployment is included.
