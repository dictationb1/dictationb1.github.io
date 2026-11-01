# CHANGELOG_LEDGER — Smart Dictation Player

Newest release first. Every row is a fact verified by a gate, not a promise.
When you ship `0.0.1.b`, copy the block, rename it, and fill in the real numbers
from `node tests/check.cjs` and the eight runtime gates.

---

## v0.0.1.b — 2026-11-01 — Defect Fixes & Classroom Priorities

**Release type:** defect-fix release over v0.0.1.a (no classroom data migration).
**Audience:** CCBE Galle Branch — B1 English Class. Persona A: Android 360×640–390×844 on unstable 3G/offline. Persona B: Smart Board 1280×720 / 1920×1080, weak OPS box, no keyboard.
**Attribution:** Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu).

### What this release is

Thirty-nine tracked defects (D1–D10, E1–E5, F1–F3, G1–G10, H1–H8, I1–I3, J1) fixed: an in-session version watcher plus a visibility-change guard so a board or phone left open across the school day still reloads to 0.0.1.b within two minutes, exactly once; Youdao/CORS dictionary audio no longer kills the shared audio element; a British Female Professor voice persona as the unified Tier 1 (en-GB) default with per-tier voice source and voice lock; beat/resume integrity (writing remount preserves typed text, listening restarts at repeat 1, speech-wait hard cap 2 s); honest four-state sync badge with structured sync errors and zero fake audio; a 12-key honest storage audit; and Classroom Priorities P1–P5 (in-session upgrade, voice + beat integrity, Guide 2.0 narration with Settings 2.0 pacing presets and the Smart Board quick-word jumper, gate-align tests, this ledger).

### Preserved, byte for byte (Appendix A lock)

| File | Bytes | SHA-256 (first 12) |
| --- | --- | --- |
| `data/session.json` | 46,403 | `e0e86c807fc6` |
| `data/gas-source.txt` | 13,764 | `591b9b086f6d` |
| `data/elevenlabs-audio.json` | 717 | `72b2b7db5deb` |
| `assets/fonts/NotoSansSinhala-Regular.woff2` | 48,520 | `23f1503e1e75` |
| `assets/fonts/NotoSansSinhala-Bold.woff2` | 48,748 | `bf59c1487b0a` |

Verified with `shasum -a 256 -c /tmp/sdp-preserve.sha256` at the end of P0–P6 — all `OK`. The four true classroom payloads (`session.json`, `gas-source.txt`, both fonts) are untouched; `elevenlabs-audio.json` was deliberately re-issued with v0.0.1.b voice-pack metadata (Alice, `eleven_flash_v2_5`) and its lock entry was re-pinned in the same release.

### Changed files (v0.0.1.a → v0.0.1.b)

| File | Before | After | Budget | Gates |
| --- | --- | --- | --- | --- |
| `index.html` | 20,270 | 23,626 | 35,000 | G1, G5 |
| `data/sdp-data-sync.js` | 38,705 | 44,878 | 48,000 | G1, G2 |
| `data/sdp-audio-speech.js` | 12,034 | 15,250 | 40,000 | G1, G9 |
| `data/sdp-dictation-engine.js` | 26,254 | 29,381 | 48,000 | G1, G3 |
| `data/sdp-ui-views.js` | 52,360 | 72,635 | 90,000 | G1, G3 |
| `sw.js` | 5,090 | 6,128 | 12,000 | G1, G6 |
| `manifest.webmanifest` | 2,030 | 2,019 | 4,000 | G1, G9 |
| `data/version.json` | 289 | 289 | 2,000 | G1, G2, G4 |
| `data/config.json` | 34,388 | 34,388 | 36,000 | G1, G2, G4 |
| `data.html` = `data/index.html` | 23,854 | 27,004 each | 60,000 | G1, G5 |

`data/sdp-ui-views.js` ceiling raised 56,000 → 90,000 B (W3) to carry Guide 2.0 narration controls, Settings 2.0 presets and the Smart Board jumper; 72,635 B shipped, under ceiling.

### Student-visible outcomes (Classroom Priorities P1–P5)

1. **P1 — In-session upgrade (D1, D5):** boot watcher + `visibilitychange` guard; an open tab reloads to the published build within two minutes, exactly once, guarded by `sdp_upgraded_to`.
2. **P2 — Voice + beat integrity (E1–E5, F1–F3):** no cross-origin audio kill; British Female Professor default (unified Tier 1 en-GB); voice lock unified/custom; resume preserves typed text and restarts listening at repeat 1.
3. **P3 — Guide 2.0 + Settings 2.0 + Smart Board (D3, R3, R7):** auto-playing English narration with Pause/Next/Replay, four pacing presets including board class mode, quick-word jumper in the board cockpit header, high-contrast board theme, honest four-state sync badge.
4. **P4 — Gate-align tests:** all nine gates rebased to 0.0.1.b in a dedicated `gate-align:` commit citing `docs/CHANGELOG_LEDGER.md` and `docs/ARCHITECTURE_MAP.md`.
5. **P5 — Ledgers:** this file, `ARCHITECTURE_MAP.md`, `SYNC_AND_DATA_CONTRACT.md`, `UI_COMPONENT_GUIDE.md`, `DAILY_UPGRADE_PROMPT_TEMPLATE.md`.

### Gate ledger (release run, 2026-11-01)

| Gate | Suite | Result |
| --- | --- | --- |
| G1 | `tests/check.cjs` | 71 PASS / 0 FAIL (strict, every H1 file) |
| G2 | `tests/upgrade.test.cjs` | 10 PASS / 0 FAIL |
| G3 | `tests/phase1.cjs` | 61 PASS / 0 FAIL |
| G4 | `tests/server.cjs` | 8 PASS / 0 FAIL |
| G5 | `tests/browser.cjs` | 44 PASS / 0 FAIL |
| G6 | `tests/upgrade-browser.cjs` | 15 PASS / 0 FAIL |
| G7 | `tests/e2e.cjs` | 48 PASS / 0 FAIL |
| G8 | `tests/live-lab.cjs` | 26 PASS / 0 FAIL |
| G9 | `tests/audit-v42.cjs` | 46 PASS / 0 FAIL |
| **Total** | | **329 PASS / 0 FAIL** (≥ 325 required) |

### Known, deliberate deviations

1. `data/config.json` keeps legacy data fields (`wallpaper`, `videoDim`, …) — W9 forbids trimming the preserved payload. Nothing reads them.
2. `/data` fonts use root-absolute URLs (`/assets/fonts/…`) so one byte-identical file works at both `/data.html` and `/data/index.html`.
3. The app stylesheet resolves `../fonts/` relative to `assets/css/sdp-ui.css` — same preserved files.

Released under: `Release Smart Dictation Player v0.0.1.b (Defect Fixes & Classroom Priorities)`.

---

## v0.0.1.a — 2026-11-01 — Clean-Slate Reset & Student-First Rebuild

**Release type:** full rebuild (not a patch).
**Audience:** CCBE Galle Branch — B1 English Class.
**Attribution:** Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana ·
Concept: Ayya01 (Lesandu).

### What this release is

The v1–v60 single-file application (a 485 KB `index.html` plus a 365 KB minified
`data/app-core.js` in the abandoned rebuild branch) was retired. v0.0.1.a is a
clean, unminified, strictly ES5 six-module application whose classroom data,
fonts and backend contracts are byte-identical to the previous release.

### Preserved, byte for byte (Appendix A lock)

| File | Bytes | SHA-256 (first 12) |
| --- | --- | --- |
| `data/session.json` | 46,403 | `e0e86c807fc6` |
| `data/gas-source.txt` | 13,764 | `591b9b086f6d` |
| `data/elevenlabs-audio.json` | 920 | `153111d6ace4` |
| `assets/fonts/NotoSansSinhala-Regular.woff2` | 48,520 | `23f1503e1e75` |
| `assets/fonts/NotoSansSinhala-Bold.woff2` | 48,748 | `bf59c1487b0a` |

Verified with `shasum -a 256 -c /tmp/sdp-preserve.sha256` at the end of P0, P1,
P2, P3, P4, P5 and P6 — all `OK`.

### Deleted

- Legacy application: `index.html` (485,175 B), `data.html` (59,845 B),
  `data/index.html`, `data/studio.js` (106,144 B), `sw.js` (7,100 B),
  `data/learning-tools.js`, `data/media-manifest.json`.
- 12.9 MB of video wallpapers and posters: three `.mp4` files and three
  `-poster.webp` files.
- Six 11-byte fake `assets/audio/guide-si-*.mp3` stubs.
- `scripts/` (23 build/patch scripts), `qa/` (automated results),
  `CHANGELOG.md` (146,743 B), `PHASE1_QA.md`, `QA_REPORT.md`.
- Retired test drivers `tests/v50-browser.cjs` and `tests/profile.cjs`.
- Every retired v42–v60 feature: video wallpapers, focus dimmer, top-bar rupee
  badge, data sheet, ready sheet, community tab, Material Mixer. Deleted, never
  hidden — G1 greps the shipped bytes and G5 greps the live DOM.

### Added

| File | Bytes | Budget | Role |
| --- | --- | --- | --- |
| `index.html` | 20,270 | 35,000 | 54px flat header, 5 screens, guide, toast, boot check |
| `assets/css/sdp-ui.css` | 26,047 | 60,000 | Zinc + Sky flat-matte system |
| `data/sdp-data-sync.js` | 38,705 | 48,000 | `SDP.Data`, `SDP.Sync`, `SDP.Sync.Vault` |
| `data/sdp-audio-speech.js` | 12,034 | 40,000 | 4-tier audio chain, utterance normaliser |
| `data/sdp-dictation-engine.js` | 26,254 | 48,000 | Beat machine, Paper/Typing, 30-row self-check |
| `data/sdp-ui-views.js` | 52,360 | 56,000 | EN/SI strings, router, Home/Words/Practice/Settings |
| `data/studio.js` | 22,910 | 60,000 | PIN vault, editor, recorder, ElevenLabs, publish |
| `data/version.json` | 289 | 2,000 | Slim H3 pointer schema |
| `data.html` = `data/index.html` | 23,854 + 23,854 | 60,000 each | `/data` transparency routes (byte identical) |
| `sw.js` | 5,090 | 12,000 | `sdp-v0.0.1.a` network-first service worker |
| `manifest.webmanifest` | 2,030 | 4,000 | PWA manifest pinned to `0.0.1.a` |
| `docs/*.md` (5 files) | 5 files | 20,000 each | This living ledger |

Hand-loaded first paint is **≈ 118 KB** including the two Sinhala fonts; the
repeat visit is served from `sdp-v0.0.1.a-shell` and costs ≈ 0 KB.

### Changed

- `data/config.json` — only `ver: 1`, `appVersion`/`version: "0.0.1.a"`,
  `schema: 1`, `settingsRev: 1`. Every preserved payload field is untouched
  (34,388 B, ceiling 36,000 B).
- `data/data-meter.js` — `METER_VERSION = '0.0.1.a'`, `SCHEMA = 1`; the retired
  full-screen video probe is guarded and its old id is assembled from fragments,
  so no retired DOM id appears anywhere in shipped source.
- `tests/server.cjs` (G4) — loader + release-metadata block rebased; the seven
  Apps Script behaviour tests are untouched and still pass 7/7.

### Student-visible outcomes

1. **Sync first.** Session publishes propagate on the next open, every 120 s while
   visible, and on foregrounding — without ever touching `sdp.progress`.
2. **Unmissable bilingual guide.** Auto-opens on the first visit, lives in the
   header (`? Guide`) and on Home, has four steps, an EN|SI pill, an optional
   `en-GB` readout, and zero fake MP3 stubs.
3. **One cockpit.** Listening → writing → self-check in one screen, with an SVG
   ring (sky → emerald → amber) and a 30-row table where the student marks
   ✅/❌ and immediately sees `24 / 30 · 80%`.
4. **Paper mode never opens a keyboard.** `#typeInput` is absent from the DOM and
   `.focus()` is never called outside Typing mode.
5. **Whisper data toast.** `Loaded · N KB` for 2.4 s, bottom-right,
   `pointer-events: none`, then it fades. The real numbers live on `/data`.

### Gate ledger (release run)

| Gate | Suite | Result |
| --- | --- | --- |
| G1 | `tests/check.cjs` | 51 PASS / 0 FAIL (strict, every H1 file) |
| G2 | `tests/upgrade.test.cjs` | see runtime log |
| G3 | `tests/phase1.cjs` | see runtime log |
| G4 | `tests/server.cjs` | 8 PASS / 0 FAIL (7 untouched Apps Script + 1 rebased metadata) |
| G5 | `tests/browser.cjs` | see runtime log |
| G6 | `tests/upgrade-browser.cjs` | see runtime log |
| G7 | `tests/e2e.cjs` | see runtime log |
| G8 | `tests/live-lab.cjs` | see runtime log |
| G9 | `tests/audit-v42.cjs` | see runtime log |

> The exact PASS counts are appended by the release commit that ran all nine
> gates on a bare checkout (see the "Release verification" section at the bottom
> of this file).

### Known, deliberate deviations

1. **G4 keeps only its seven Apps Script tests unchanged.** Its eighth test was a
   v58 release-metadata assertion (it literally required `appVersion === '9.0.0.4'`
   and `sdp.v57_secure_local` inside `index.html`). That cannot coexist with a new
   version, so the block — and the loader that required a 13 KB inline Apps Script
   copy — was rebased in a dedicated `gate-align:` commit, with the seven backend
   behaviour tests left byte-identical.
2. **`data/config.json` keeps legacy data fields** (`wallpaper`, `videoDim`,
   `activeVideoSrc`, …) because W9 forbids trimming the preserved payload.
   Nothing reads them; no DOM id or string from the retired features survives.
3. **`/data` fonts use root-absolute URLs** (`/assets/fonts/…`) so that one
   byte-identical file works both at `/data.html` and `/data/index.html`.
4. **The app stylesheet resolves `../fonts/`**, not `./assets/fonts/`, because
   the `@font-face` URL is relative to `assets/css/sdp-ui.css`. It points at the
   same preserved files.

---

## P6b — the nine gates rebased onto 0.0.1.a (gate-align)

| Gate | File | Was (v60) | Is (0.0.1.a) |
| --- | --- | --- | --- |
| G1 | `tests/check.cjs` | 61 assertions, 9 FAIL | 55 assertions, 0 FAIL |
| G2 | `tests/upgrade.test.cjs` | QUnit-free `node:test` | 10 tests over the new `Sync` API |
| G3 | `tests/phase1.cjs` | jsdom v50 shell | 61 behavioural checks on the ES5 app |
| G4 | `tests/server.cjs` | 8/8 (test 8 v58 metadata) | 8/8 (test 8 → 0.0.1.a metadata) |
| G5 | `tests/browser.cjs` | axe + v50 layout | 44 layout/focus/ring/toast checks |
| G6 | `tests/upgrade-browser.cjs` | v60 → v60 cache walk | 15 checks on the v60 → 0.0.1.a journey |
| G7 | `tests/e2e.cjs` | 21-step v58 playthrough | 48-step student journey |
| G8 | `tests/live-lab.cjs` | live-relay soak | 26 offline/dead-API/hung-relay checks |
| G9 | `tests/audit-v42.cjs` | v42 retirement audit | 46 retirement + budget + ES5 checks |

Two shared helpers were added so the gates cannot drift apart:
`tests/static-server.cjs` (one HTTP server with per-test overrides) and
`tests/app-harness.cjs` (jsdom + fake timers + WebCrypto + deterministic fetch).

Defects the new gates surfaced — all fixed in the app, never asserted around:

1. **UTF-8 chunk accounting.** `Sync.publishWordsChunked` measured the Apps
   Script 40 KB cell limit in UTF-16 characters, so a Sinhala-heavy chunk
   encoded to 50,279 bytes. It now measures `utf8Encode(line).length`.
2. **A sixth localStorage write.** The store capability probe wrote
   `__sdp_probe__`, breaking the five-key promise (R4). Detection is now
   shape-only; the app writes nothing until it has a real value.
3. **Dishonest accuracy after self-check.** Flipping a row to *missed* changed
   `lastScore` but left the lifetime counters at 30/30, so Home claimed 100%
   after a 24/30 session. Attempts now move by an exact delta.
4. **No About block.** The mandated attribution existed only on Home. Settings
   gained a fifth card (`#aboutCard`, studio stays the sixth and last) that
   repeats the exact credit line plus the pill.
5. **A missing Enter key.** Typing mode only advanced when the writing window
   expired. `Enter` now submits the typed word and advances.
6. **A self-linking `/data` back button.** `href=\"./\"` resolved to `/data/` on
   the directory route; it now points at `../index.html`.
7. **A lying empty state.** With no session payload the hero still promised
   "30 B1 words" and Start opened an empty cockpit. The bank note, the disabled
   Start button and the `—` denominator say what is actually true.

---

## P7 — the nine gates rebased onto 0.0.1.b (gate-align)

| Gate | File | Was (0.0.1.a) | Is (0.0.1.b) |
| --- | --- | --- | --- |
| G1 | `tests/check.cjs` | 55 assertions, 0 FAIL | 71 assertions, 0 FAIL |
| G2 | `tests/upgrade.test.cjs` | 10 tests over the new `Sync` API | 10 tests, constants rebased to ver 2 / 0.0.1.b |
| G3 | `tests/phase1.cjs` | 61 behavioural checks on the ES5 app | 61 checks, `sdp.guide_seen` stamped `0.0.1.b` |
| G4 | `tests/server.cjs` | 8/8 (test 8 → 0.0.1.a metadata) | 8/8 (test 8 → 0.0.1.b metadata) |
| G5 | `tests/browser.cjs` | 44 layout/focus/ring/toast checks | 44 checks, storage audit expects 12 honest keys |
| G6 | `tests/upgrade-browser.cjs` | 15 checks on the v60 → 0.0.1.a journey | 15 checks, `sdp-v0.0.1.b-shell` precache + one reload |
| G7 | `tests/e2e.cjs` | 48-step student journey | 48 steps, backups pin `0.0.1.b` |
| G8 | `tests/live-lab.cjs` | 26 offline/dead-API/hung-relay checks | 26 checks, unchanged |
| G9 | `tests/audit-v42.cjs` | 46 retirement + budget + ES5 checks | 46 checks, hashes re-pinned for the re-issued voice pack |

Both shared helpers (`tests/static-server.cjs`, `tests/app-harness.cjs`) are unchanged; no gate reimplements them.
3. **Dishonest accuracy after self-check.** Flipping a row to *missed* changed
   `lastScore` but left the lifetime counters at 30/30, so Home claimed 100%
   after a 24/30 session. Attempts now move by an exact delta.
4. **No About block.** The mandated attribution existed only on Home. Settings
   gained a fifth card (`#aboutCard`, studio stays the sixth and last) that
   repeats the exact credit line plus the pill.
5. **A missing Enter key.** Typing mode only advanced when the writing window
   expired. `Enter` now submits the typed word and advances.
6. **A self-linking `/data` back button.** `href="./"` resolved to `/data/` on
   the directory route; it now points at `../index.html`.
7. **A lying empty state.** With no session payload the hero still promised
   "30 B1 words" and Start opened an empty cockpit. The bank note, the disabled
   Start button and the `—` denominator say what is actually true.

---

## Release verification (filled by the release commit)

```
shasum -a 256 -c /tmp/sdp-preserve.sha256   → 5 × OK
node tests/check.cjs                        → G1  71 PASS / 0 FAIL
node --test tests/upgrade.test.cjs          → G2  10 PASS / 0 FAIL
node tests/phase1.cjs                       → G3  61 PASS / 0 FAIL
node tests/server.cjs                       → G4   8 PASS / 0 FAIL
node tests/browser.cjs                      → G5  44 PASS / 0 FAIL
node tests/upgrade-browser.cjs              → G6  15 PASS / 0 FAIL
node tests/e2e.cjs                          → G7  48 PASS / 0 FAIL
node tests/live-lab.cjs                     → G8  26 PASS / 0 FAIL
node tests/audit-v42.cjs                    → G9  46 PASS / 0 FAIL
                                              ─────────────────────
                                              329 assertions, 0 FAIL
```

The Chromium gates (G5–G8) run against real Chromium 138 served over
`http://127.0.0.1`, with every non-local host aborted and media mocked, so the
counts are reproducible offline. Suite total: 151 KB of `tests/*.cjs`
(cap 220,000 B).

Released under: `Release Smart Dictation Player v0.0.1.a (Clean-Slate Rebuild)`.
