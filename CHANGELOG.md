# Changelog

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
