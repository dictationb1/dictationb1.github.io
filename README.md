# Smart Dictation Player

Smart Dictation Player is a self-contained English dictation app for CCBE Galle Branch. The player is `index.html`; the interactive bilingual data report is available at `/data` and `/data.html`.

## Release 6.0.0 — v54

The cross-device API-key bug is fixed permanently: a **PIN-encrypted vault** (`SDP_ENC_V1:`) plus a **three-channel universal sync engine** carry the ElevenLabs key, the GitHub token, the voice settings, the wallpaper, the session and the word list to every device, with **zero configuration** on the second phone.

### 1. Encrypted vault (`window.EncryptedVault`)

- Pure ES5 deterministic crypto: multi-round SHA-256 key derivation and a stream-XOR body behind a MAC, URL-safe Base64, key `String(pin || "78987898") + "::sdp_galle_v54_salt"`, output always prefixed `SDP_ENC_V1:`.
- Payload: `syncRev`, `elevenLabsKey`, `elevenLabsVoiceId`, `elevenLabsModel`, `ghToken`, `adminPin`, `activeVideoSrc`, `videoDim`, `mode`, `writeFixed`, `repeats`, `sessionTitle`, `sessionDate`, `classInfo`.
- `EncryptedVault.applyRemoteVault(cipher)` decrypts with `78987898` on boot, on `visibilitychange` and the instant Lecturer Mode unlocks, applies when `syncRev` is newer (or when the local key is empty and the remote one is not) and repaints `#elApiKeyInput`, `#elVoiceSelect`, `#elModelSelect`, `#ghTokenInput`, `#profSessionTitle`, `#profSessionDate` and `#adminQuickWordsInput`.
- The same PIN always produces byte-identical ciphertext, a wrong PIN or one flipped byte returns `null`, and no plaintext `sk_` string is ever stored in the vault, committed to GitHub, published to `data/config.json` or sent to the relay.

### 2. Universal sync (`window.UniversalSync`)

- `pushAll(reason, cb)` stamps `syncRev = Date.now()` and fires three channels in parallel: the zero-config relay `https://ntfy.sh/dictationb1_sdp_vault_v54` (`{Title: "SDP-Sync-"+syncRev, Cache: "yes"}`, envelope `{syncRev, vaultCiphertext, sessionTitle, sessionDate, classInfo, words, pastSessions}`), `GitHubSync.commitFiles` for `data/config.json`, `data/session.json`, `data/version.json` and `data/elevenlabs-audio.json`, and the clip relay `https://ntfy.sh/dictationb1_sdp_audio_v54` for every generated clip.
- Pushes fire on `💾 Save & Verify`, the auto-completer, generate-missing, a clip delete, the GitHub verify button and any wallpaper/settings change in Lecturer Mode — the studio works with **only** an ElevenLabs key and no GitHub token.
- `pullAll(onDone)` runs on boot, `visibilitychange`, Lecturer unlock and the new `🔄 Sync Now Across All Devices` button (`#btnForceSync`), cache-busts all three JSON reads, polls both ntfy topics with `?poll=1&since=all`, optionally reads the Apps Script backend, and applies the highest `syncRev`. The sync bar reads `✓ 100% Synced Across All Devices · Last Saved: <time> · API Key: Saved & Encrypted · Voice Clips: NN`.
- Headless QA never spends a credit or calls the network: remote channels are skipped for `/HeadlessChrome/i` user agents and on `file:` origins, and nothing is pushed during boot.

### 3. Preserved from v51–v53

- The three-card Professor Studio (words card, `#elVaultList` voice vault, keys card) with the collapsed advanced deck, the zero-drain `ElevenVault.strictAdminOnly` credit lock, the auto-completer, the single-run `#credit` spotlight, the 1000 ms 3-2-1 countdown, static `#btnPause` and `#btnTestVoice`, the rendered `#resSummary`, the EN/SI guide, the Hooded Red Eyes default wallpaper with all three `/assets/` videos muted, and real `backdrop-filter: blur(14px) saturate(1.6) brightness(1.03)` Liquid Glass everywhere.

### Release facts

- Storage key: `sdp.v54_encrypted_universal_sync` (a v53 device migrates without losing words, keys or the chosen wallpaper).
- `APP_VERSION`: `6.0.0`; `ver`, `schema` and `settingsRev`: `54`; PIN `78987898`; voice Alice `Xb7hH8MSUJpSbSDYk0k2`; model `eleven_flash_v2_5`.
- `index.html` is a single ES5 file of **437,887 bytes** with no external `<link>` and no paid endpoint (the studio and the sync engine are lazy-loaded from `data/studio.js`, 72,641 bytes ES5). `tests/check.cjs` enforces the **448,000**-byte ceiling.
- Tests: `check`, `phase1` (72), `server` (8), the rewritten `upgrade.test` (24), `live-lab` (16), `audit-v42` (42), `browser` (36), `e2e` (45) and `upgrade-browser` (21) all pass with 0 errors, including the two-device key simulation in JSDOM and in real Chromium. ElevenLabs audio content and provider availability are exercised with mocked responses only and are not certified.

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
