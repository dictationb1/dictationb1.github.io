# Smart Dictation Player

Smart Dictation Player is a self-contained English dictation app for CCBE Galle Branch. The player is `index.html`; the interactive bilingual data report is available at `/data` and `/data.html`.

## Release 5.8.0 — v52

ElevenLabs one-time studio voice vault, one-click admin word auto-completer, the Hooded Red Eyes default wallpaper and the complete 13-point audit fixes.

### ElevenLabs one-time studio voice (protected free credits)

- Admin mode (PIN `78987898`) → **🎙️ ElevenLabs Studio Voice Plugin & Credit Manager**: paste the API key, `💾 Save & Verify Key`, pick one British English woman professor voice (Alice `Xb7hH8MSUJpSbSDYk0k2` by default, with Charlotte, Lily, Dorothy and a custom Voice ID field) and a model (`eleven_flash_v2_5` at 0.5 credits/character by default, `eleven_multilingual_v2` at 1).
- Every utterance in the app (User Guide, `Are you ready?`, Test sound, the 3–2–1 countdown, `Number 1..30`, both word passes, Repeat, Slower, Repeat sentence, Spell it, Pause, resume and Finish) goes through `Speech` → `ElevenVault` → the single locked studio voice.
- Clips are generated **only once ever**, in this order: `data/elevenlabs-audio.json` (shared, 0 credits for every student) → IndexedDB `sdp_elevenlabs_vault_v1` + Cache API `sdp-elevenlabs-v52` + memory → live ElevenLabs request (only with a saved key, de-duplicated in flight) → the unified British Youdao stream as a fallback. `📥 Download data/elevenlabs-audio.json` exports the whole vault so it can be committed for every device.
- `⚡ Generate Missing Session Clips Once (Skip Cached)` and `📦 Generate Full Pack` show the cached count, the estimated characters/credits and a live progress bar.

### One-click word auto-completer

- Admin mode → **✨ Quick Dictation Words Input**: type or paste only the words. IPA, English definition, Sinhala meaning and an example sentence are filled from the built-in lexicon, `api.dictionaryapi.dev` and Google Translate (`sl=en&tl=si`), the previous session is archived into `pastSessions`, the new session is published and (with a key) its ElevenLabs clips are generated once.

### Release facts

- Default wallpaper `./assets/hooded_red_eyes_live_wallpaper_1080p_loop.mp4`; all three `/assets/` videos in the gallery; true `blur(14px) saturate(1.6) brightness(1.03)` glass.
- Storage key: `sdp.v52_elevenlabs_studio`
- `APP_VERSION`: `5.8.0`; `ver`, `schema` and `settingsRev`: `52`
- Single-file ES5 build; the byte budget in `tests/check.cjs` and `tests/phase1.cjs` is 456,000 bytes (the page is ~455 KB with the ElevenLabs engine and admin studio inlined).

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
