# Smart Dictation Player

Smart Dictation Player is a self-contained English dictation app for CCBE Galle Branch. The player is `index.html`; the interactive bilingual data report is available at `/data` and `/data.html`.

## Release 5.9.0 — v53

A clean three-card **Professor Studio** in admin mode, a strict zero-drain credit lock, permanent cross-device GitHub sync and the complete 13-point audit fixes.

### 1. Admin panel redesign (PIN `78987898`)

- **Card 1 — the weekly word list.** Session title, session date, class/lecturer info, a big word box and a live counter. Type or paste only the words and press **🚀 Save Words, Auto-Complete Meanings & Publish to All Devices** once: IPA, English definition, Sinhala meaning and an example sentence are filled, the previous week is archived into `pastSessions`, the new session is published and only the *missing* voice clips are generated. A collapsible preview table shows `#1..#30`.
- **Card 2 — the permanent voice vault.** `#elVaultList` lists every saved clip with preview and per-clip delete, shows the clip count, the missing-clip cost estimate and the remaining credit balance, and offers `⚡ Generate & Save Missing Clips to GitHub Now`, `📥 Download data/elevenlabs-audio.json`, `📤 Upload data/elevenlabs-audio.json` and `🗑️ Delete All`.
- **Card 3 — the one-time keys.** ElevenLabs key + `💾 Save & Verify`, studio voice (Alice `Xb7hH8MSUJpSbSDYk0k2` by default), model (`eleven_flash_v2_5`, 0.5 credits/character), GitHub token + `🔗 Save & Test GitHub Sync`.
- Everything technical (words & planner, session, announcements, comments, class stats, diagnostics) moved into one collapsed `<details class="admin-advanced">` panel.

### 2. Zero-drain credit lock

- `ElevenVault.strictAdminOnly = true`: `api.elevenlabs.io/v1/text-to-speech` is reachable from exactly one function, `ElevenVault.adminGenerateMissing()`, and only while an admin generation cycle is running. Saved clips are never regenerated; a missing clip reports `missing` and playback falls back to the British Youdao stream (`https://dict.youdao.com/dictvoice?type=1&audio=…`) at **0 credits**.

### 3. Cross-device sync

- `GitHubSync` / `Cloud.commitFiles` commit `data/session.json`, `data/version.json`, `data/config.json` and `data/elevenlabs-audio.json` to `dictationb1/dictationb1.github.io` on `main` through the GitHub Contents API (read the live `sha`, then `PUT` base64), with `Cloud.publish` / `Cloud.fetchRemote` for the class channel and `ElevenVault.loadSharedVault()` at boot so a new phone sees the same words and the same voice clips.

### Release facts

- Storage key: `sdp.v53_github_voice_sync` (a v52 device migrates without losing words, keys or the chosen performance mode).
- `APP_VERSION`: `5.9.0`; `ver`, `schema` and `settingsRev`: `53`.
- `index.html` is a single ES5 file of **431,069 bytes** with no external `<link>` and no paid endpoint (the studio is lazy-loaded from `data/studio.js`, 59.8 KB ES5). `tests/check.cjs` enforces the **448,000**-byte ceiling.
- Tests: `check`, `phase1`, `server`, `upgrade.test` (18 gates), `live-lab` (16), `audit-v42` (42), `browser` (32), `e2e` (44) and `upgrade-browser` (20) all pass with 0 errors. ElevenLabs audio content and provider availability are exercised with mocked responses only and are not certified.

## Release 5.7.0 — v51

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
- The default local lecturer PIN is `78987898`. It is stored as a salted hash rather than cleartext; this client-side lock is not server-grade protection.

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

The static gate checks ES5 syntax, rejects static `<link>` tags and enforces a 445,000-byte ceiling for `index.html` (the release target remains below 430,000 bytes). The Chromium tests use real DOM, layout and media-element decoding with a local WAV response fixture; they cover the slow rate, helper timing, pause/resume, Full/Lite glass and credit clearance at desktop and phone sizes. They do not verify real cloud accounts, external voice recordings or iPhone Safari audio policy. Historical comparison cases skip when their old Git objects are unavailable. Generated traces and screenshots belong in ignored `tests/artifacts/`.
