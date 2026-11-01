# Smart Dictation Player

Smart Dictation Player is a self-contained English dictation app for CCBE Galle Branch. The player is `index.html`; the interactive bilingual data report is available at `/data` and `/data.html`.

## Release 9.0.0.3 — v60

v60 replaces the entire student-facing UI with a next-gen Zinc/Sky design system rendered from `data/learning-tools.js` (zero new CSS in `index.html`, which stays at 484,800 bytes): a compact data-driven hero, three stat cards, a 2×2 quick-practice grid, a five-slot tab bar, a 232px desktop rail, priority-first settings with the whole technical body collapsed, a dictation cockpit that replaces the lens player, and 30 flat word cards with UK IPA, POS, meaning, example and Sinhala.

- Legacy `#sdpV57Css` / `#sdpV58Css` are neutralised at boot and `#sdpNextGenCss` is pinned last in `<head>`; every surface is flat (`backdrop-filter:none`) in Full and Lite.
- `sw.js` is `sdp-v60-9.0.0.3` with per-entry caching, network-first html/js/json, `skipWaiting` and `activate` eviction; `sdp-youdao-v1` audio is preserved.
- Storage key remains `sdp.v57_secure_local` (ver/schema/settingsRev 60), offline words use `sdp_offline_v60`.
- `APP_VERSION`: `9.0.0.3`; voice Alice `Xb7hH8MSUJpSbSDYk0k2`; model `eleven_flash_v2_5`; vault PBKDF2 250,000.
## Historical release 8.0.0 — v59 (superseded by v60)

v59 is the human-scale usability release: a spacious, readable design system that lives entirely in `data/learning-tools.js` (so `index.html` adds **0 bytes of CSS** and stays at 484,758 bytes), a strictly **100% English default**, full-English dictionary word cards (word · UK IPA · part of speech · meaning · example), one unified `UI.applyLang()`, `window.SDPPerfGuard` auto-selecting Lite when frames drop, an O(1) arithmetic WCAG gauge with zero canvas readbacks, and all eight learning tools fixed (paper self-check rows, live `#resSummary`, six-column A4 sheet, Sentence Context **Next question →** with a green correct state, iOS-safe Speak & Compare, honest offline pack counting).

- GPU budget: backdrop blur only on `.topbar`, `#tabbar` and open scrims (`blur(14px) saturate(1.4)`); chips, tiles, buttons, rows and cards are flat — never blurred.
- `sw.js` is `sdp-v59` (`sdp-v59-shell` / `sdp-v59-media`); Youdao word audio still lives in `sdp-youdao-v1`.
- Storage key remains `sdp.v57_secure_local` (data migrates in place; ver/schema/settingsRev 59).
- `APP_VERSION`: `8.0.0`; `ver`, `schema`, `settingsRev`: `59`; voice Alice `Xb7hH8MSUJpSbSDYk0k2`; model `eleven_multilingual_v2`.
- `Speech.ensureGain` never calls `createMediaElementSource()` on the cross-origin Youdao `<audio>`, so Android Chrome and iOS Safari keep their sound.

## Historical release 7.0.0 — v58 (superseded by v59)

v58 is the Liquid Glass + learning release. Two-tier runtime glass (Tier A chrome `blur(18px) saturate(1.7)`, Tier B ≥94% Optical Core reading surfaces), Sinhala WOFF2 fonts (runtime `@font-face`, ≤60 KB, no static `<link>`), the Android `visualViewport` keyboard dock (`#v58Dock` / `body.v58-keyboard`), a desktop ≥1024px two-column workspace with `#v58KbdHud` shortcuts (`window.SDP.__kbdTests`), the compact 3-card home (`#v58PracticeBento`, `#v58ProgressArchiveCard`, inline `#credit` signature pill → `#aboutCreditsSheet`), grouped overflow menus, three contrast presets with a real composited WCAG gauge, data meter v2 (plans, cache honesty, 2-panel data sheet) and the eight learning features in `data/learning-tools.js` (`window.SDPLearning`).

- `sw.js` is `sdp-v58`: shell precaches `data/learning-tools.js` + the two Sinhala fonts; Youdao word audio still lives in `sdp-youdao-v1`.
- Storage key remains `sdp.v57_secure_local` (data migrates in place; ver/schema/settingsRev 58).
- `APP_VERSION`: `7.0.0`; `ver`, `schema`, `settingsRev`: `58`; voice Alice `Xb7hH8MSUJpSbSDYk0k2`; model `eleven_multilingual_v2`.
- New scripts/tests: `data/learning-tools.js` is strict ES5 and covered by `tests/check.cjs`, `tests/upgrade.test.cjs` and the Chromium suites.

## Historical release 6.3.0 — v57 (superseded by v58)

v57 is a security and data-truth release. There is **no shared/default lecturer PIN**, no public key vault, and no vault/key/audio ntfy relay. The first valid 4–8 digit unlock on a device creates a local random-salted `sha256("sdp.v2:" + deviceSalt + ":" + pin)` verifier; later unlocks verify it, and Lecturer Mode includes **Change Lecturer PIN**.

### P0 — security and honest metering

- Raw ElevenLabs/GitHub keys live only in `sessionStorage` (`sdp.session.elKey`, `sdp.session.ghToken`) while Lecturer Mode is unlocked on that tab. `localStorage`, exports and public JSON are scrubbed of keys, PIN hashes and vault ciphertext.
- Every vault write uses `SDP_ENC_V2:` — PBKDF2-SHA256 (150,000 iterations) + AES-GCM-256 with random salt/IV. Legacy V1 is read-once migration only; new V1 writes are disabled.
- Studio and inline paid ElevenLabs calls require `strictAdminOnly` **and** `Admin.isUnlockedOnThisDevice()`. Student playback is cache/committed-clip first, then Youdao, then pinned en-GB device synthesis; it can never spend ElevenLabs credits.
- Publishing uses the authenticated GitHub Contents API only. GitHub instructions require a fine-grained, repo-scoped, 90-day token with Contents read/write. Session/config commits are blocked until the lecturer confirms an editable 30-word publish preview.
- `data/data-meter.js` measures buffered video bytes from the buffered time fraction, persists only session deltas, reconciles real fetch `content-length`, labels cross-origin Youdao plays as an explicit ~11,000-byte estimate, preserves totals when the resource buffer clears, and formats B/KB/MB correctly. `/data` and `/data/index.html` are byte-identical, default to a 0-MB static background, and show live session/today MB/LKR cards plus Sri Lankan rate presets.

### P1 — readability and voice

- New devices default to **Static Gradient (0 MB video)**. The wallpaper gallery is opt-in and labels each file's exact MB size. `saveData` or slow-2g/2g/3g immediately returns to Static.
- The dimmer is 0–100 (default 18) and shows a real WCAG relative-luminance contrast ratio, warning below 4.5:1. Reading panels use ≥0.92 opacity, secondary text ≥82%, and true Lite mode disables all backdrop filters. The dead Material Mixer is removed.
- Speed, volume (GainNode when available), repeats 1/2/3, example-sentence toggle and writing seconds 3–60 are wired to the engine. A 192/128/64-kbps selector, voice presets, volume normalization, bilingual playback-failure retry toast and durable `sdp-youdao-v1` caching/prewarming are included.
- Committed ElevenLabs clips are primary when present. The lecturer studio can generate all session words plus `Number 1…31`; generation is admin-only and commits clips to `data/elevenlabs-audio.json` through GitHub. No clips are fabricated in QA.

### P2/P3 — layout, results and offline

- The fixed credit banner, credit cycling/replay and duplicate hero credit are removed; About credit and a static footer remain. Phones get a compact DICTATION title and reclaimed topbar/app offsets.
- The header has three controls: language, live data, and an overflow menu that retains the existing IDs/selectors. The fake `#sdpV56` depot is completely removed; there is exactly one `dataRateLkrInput`, one primary Data Sheet entry plus `?data=1`, and one Past Sessions heading.
- Results show anonymous missed words; unlocked lecturers get a weakness radar, error percentages and CSV export.
- `sw.js` is `sdp-v57`: video HTTP Range requests are answered with 206 slices from a cached full response, while a background full fetch fills `sdp-v57-media`.

### Release facts

- Storage key: `sdp.v57_secure_local` (legacy v56/v55 keys are migrated; PIN verifiers reset on migration so no compromised default survives).
- `APP_VERSION`: `6.3.0`; `ver`, `schema`, `settingsRev`: `57`; voice Alice `Xb7hH8MSUJpSbSDYk0k2`; model `eleven_multilingual_v2`.
- `index.html` remains strict ES5 and under the 600,000-byte ceiling; the only external `<link>` is the PWA manifest.

## Historical release 5.7.0 — v51 (superseded by v57)

Session 8 contains 30 adjectives with UK IPA, Sinhala meanings and examples; the complete 30-word Session 7 remains available for practice. Paper mode, two readings and a five-second writing period are the defaults.

### Audio and player controls

- English numbers, words and phrases use the same Youdao UK endpoint. A failed stream or a 2,800 ms start timeout falls back to one pinned British device voice when available. There is no per-word Google dictionary fallback.
- Each word cycle announces `Number N`, waits 180 ms, plays the word, waits 650 ms and replays the same URL. The countdown uses monotonic one-second beats; a playing welcome instruction fades for 120 ms first. Four hidden audio elements prebuffer countdown cues and a rolling two-word window.
- Repeat, Slower, Repeat sentence and Spell it interrupt speech or writing and restart the full writing period after the helper completes. Spell it uses British letter names; Slower persists at `0.72`. Pause cancels speech and timers, and Resume restarts the current word after its prompt. The completion summary is both shown and spoken.
- The first-run guide attempts to play automatically and can retry after a user gesture. Sinhala guide text uses chunked Youdao Sinhala audio or a supported `si-LK` device voice, never English romanisation. Closing the guide stops it.

Remote providers and installed voices vary by device and network. A single endpoint does not guarantee a particular speaker or pronunciation. The automated tests intercept remote audio and **do not certify audio content or provider availability**. The data report's usage figures are illustrative estimates, not measured guarantees.

### Appearance and saved data

The muted Hooded Red Eyes video is the default and uses cover framing on phones and desktops. The gallery includes all three bundled videos and can refresh the assets list from GitHub. Both Full and Lite retain true `blur(14px) saturate(1.6) brightness(1.03)` glass. The Hansana credit has a one-time intro followed by one eight-second spotlight cycle; modal dialogs remain above it.

- Storage key: `sdp.v51_hooded_liquid_glass`
- `APP_VERSION`: `5.7.0`; `ver`, `schema` and `settingsRev`: `51`
- The default local lecturer PIN is `the default PIN`. It is stored as a salted hash rather than cleartext; this client-side lock is not server-grade protection.

Migration reads v50 and older known keys, preserves learner lists, history, comments and explicit performance choices, replaces the old bunny default with the hooded video, and removes legacy `adminPin` fields. Export a backup before experimenting.

## Development verification

Install development-only dependencies and run the release gates from the repository root:

```sh
npm ci --prefix tests
node tests/check.cjs
node --test tests/upgrade.test.cjs
node tests/phase1.cjs
node tests/browser.cjs
node tests/upgrade-browser.cjs
node tests/e2e.cjs
node tests/server.cjs
node tests/live-lab.cjs
node tests/audit-v42.cjs
```

The static gate checks ES5 syntax, requires the WebCrypto AES-GCM vault, a Service Worker and a PWA manifest (the only permitted `<link>` is the manifest), enforces a 600,000-byte ceiling for `index.html` and keeps every public document free of the example PIN. The Chromium tests use real DOM, layout and media-element decoding with a local WAV response fixture; they cover the slow rate, helper timing, pause/resume, Full/Lite glass, credit clearance and the live Resource-Timing data meter at desktop and phone sizes. They do not verify real cloud accounts, external voice recordings or iPhone Safari audio policy. Historical comparison cases skip when their old Git objects are unavailable. Generated traces and screenshots belong in ignored `tests/artifacts/`.
