# Smart Dictation Player

A standalone, offline-capable ES5 `index.html` with two bundled wallpaper assets in `assets/`. No build, CDN, or runtime JavaScript dependency. Open the file directly, or serve it over HTTPS. Development test packages are not used by the app.

## Release status

**4.9.0 (v42, 2026-10-28)** keeps Session 7 — Travel & Transport (30 words, two repeats, a fixed 5-second writing timer and one locked British English studio voice), paper and typing modes, the English-first guide with an optional Sinhala toggle and the live class channel. Dictation **speaks the dictation number on every item**: Pass 1 says `"Number 1. bicycle."` (or `"Final word. Number 30. windscreen."`), a 700 ms studio silence follows, Pass 2 repeats only the clean word (`"bicycle"`, `"bus stop"`), and then the 5-second writing timer starts. The player shows `Dictation #N of 30`, `#btnReplay` repeats the number and the word, and every spoken filler phrase stays deleted.

The whole app still **opens in English**: `<html lang="en">`, `DB.defaults()`, `UI.init()`, `resetToV42` and `data/*.json` all ship `lang:"en"` and `guideLang:"en"`. Sinhala moved to an optional `English | සිංහල` toggle inside the welcome guide, and `.si`/`[lang="si"]`/`#guideBody` keep the `"Noto Sans Sinhala","Iskoola Pota"` stack at `line-height:1.72` so pillam never clips.

v42 finishes the single-voice job. v41 moved every clip to Google's `translate_tts`, which answers unauthenticated calls with **403 silence** — a dead microphone with no error. v42 deletes that endpoint for good and returns to the only host that speaks every string in one actress: `https://dict.youdao.com/dictvoice?type=1&audio=`. The endpoint is a **hybrid** dictionary server, so the only thing that keeps one voice is the *format*: every string is now sent with a trailing **space + period** (`"bicycle"` → `audio=bicycle%20.`, `"Number 1, bicycle"` → `audio=Number%201%2C%20bicycle%20.`), which selects the Unified British Female Neural TTS instead of the legacy single-word clip table. `TTS.getSingleVoiceUrl(text)` trims the text, drops a trailing `.`/`!` and appends `" ."`; `TTS.cleanWordOnly(raw)` still strips bilingual slashes (`tyre/tire` → `tyre`). The retired `translate.googleapis.com`, `ssl.gstatic.com`, `api.streamelements.com` and every multi-voice fallback stay gone. v40 streamed everything from `dict.youdao.com/dictvoice?type=1`, a **hybrid** server that returns a pre-recorded human clip for a single word but a different synthesizer for a compound phrase or a number — so `"bicycle"` and `"bus stop"` were audibly different women. That host is gone. `TTS.cleanWordOnly(raw)` still strips bilingual slashes (`tyre/tire` → `tyre`), and `TTS.getSingleVoiceUrl(text)` now returns exactly **one neural `en-GB` stream** for every string in the app: `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-GB&ttsspeed=0.95&q=<encodeURIComponent(text)>`. The dictionary speaker, practice replays, the dictation numbers, the instructions, the countdown, pause/resume and the finish summary all call that same function, so no screen can switch actress. `TTS.preloadSessionWords(words)` warms the HTTP cache, and `TTS.preBuffer(texts)` warms `TTS.audioCache` with `<audio preload="auto" referrerpolicy="no-referrer">` nodes so instructions, `"Three, two, one."` and the next three dictations play with zero lag. On a live online browser `window.speechSynthesis.cancel()` is called and `speak()` is **never** invoked; the device voice survives only for HeadlessChrome/jsdom test runs and a fully offline browser. `CONFIG.lockedVoice`/`settings.voice` stay `"Amy"` and the UI reads **British English Studio Voice (en-GB · Professional)**.

All playback goes through **one persistent, unlocked `<audio id="ttsMasterAudio">`** that ships in the static HTML (`preload="auto"`, `playsinline`, `referrerpolicy="no-referrer"`, never `crossOrigin`). `TTS.unlock()` runs on the first `pointerdown`/`click`/`touchstart`/`keydown` and synchronously inside `Eng.start()`, `Eng.readyGo()` and `UI.startPractisingFromGuide()`, priming both the element and `window.speechSynthesis`, so playback never trips `NotAllowedError`. The whole lifecycle is one voice, guarded by `var token = ++TTS._seqToken`: `Eng.start()` opens `#readySheet` and immediately speaks the brief pre-ready instructions (`"Welcome. Prepare your pen and paper. Each word is read twice. Press Yes, I'm ready to begin."`, or the typing variant), the learner taps **I'm ready**, `Eng.readyGo()` stops that clip and speaks `"Three, two, one."` in sync with the 3→2→1 visual countdown before Word 1 launches, then `"Number 1. bicycle."` → 700 ms silence → `"bicycle"` → the 5-second writing timer → Word 2 … Word 30 with `🔊 Number N of 30 · Listening (1 of 2)…` status text. Pausing says `"Session paused."` (`⏸ Paused · Dictation #N`), resuming says `"Welcome back. Continuing dictation number N."` and restarts the full reading and the full timer, and finishing says `"Dictation complete. Well done. Review all thirty words below."` (paper) or `"Dictation complete. Well done. Your score is N percent."` (typing). Every **Test sound** button (`#btnReadyTest`, `#btnTestVoice`, the player and Diagnostics) calls `TTS.testSound()`, which plays `"Sound check. Number 1. bicycle."` with the exact same voice and flips the pill to **✓ Dictation Voice Verified**. `#ttsMasterAudio` gets 3500 ms to buffer and play the studio MP3; a stalled clip is retried with `load()`/`play()` on the same single URL — never another voice — and a 6000 ms end-watchdog only rescues a genuinely stuck stream, while a 60 ms budget keeps headless tests instant. No other audio element is ever created; `TTS.audioCache` keeps the pre-buffered session URLs so Rep 2 and every replay are instant.

The interface is **architectural, not AI-bubbly**: every 999px pill, orb, disc, ring, stripe and decorative blob is hidden, buttons and inputs are 10px rectangles, segment tracks 11px with 8px thumbs, `#tabbar` 16px with 11px tabs, cards 16px and tiles 12px, with sheets and modals as an opaque `rgba(9,14,28,.90)` reading surface so a guide step never washes out over a bright video frame. Primary actions are a flat cobalt CTA (`linear-gradient(180deg,#3b82f6,#2563eb)` with a hairline rim), secondaries are graphite `rgba(17,24,39,.88)`, cards are `rgba(11,15,25,.72)`, `backdrop-filter` is `none !important` everywhere, `--fg:#f8fafc`/`--muted:#cbd5e1`, and the neon text-shadows and `-webkit-text-stroke` outlines are gone.

Motion is GPU-only and **silky at 120 fps**: controls respond in `0.16 s cubic-bezier(.16,1,.3,1)` with a `scale(0.965) translateZ(0)` press at `0.04s`, screens/sheets/layers/segment thumbs glide on `transform 0.22s cubic-bezier(0.16,1,0.3,1), opacity 0.18s`, and the old bouncy spring is retired. **"CREDITS GOES TO Hansana" is still the first thing the eye reads**: a 10px dark badge with an amber hairline and `z-index:9999` lifts into a 2.8 s top-centre spotlight (`translate3d(-50%,12px,0) scale(1.04)`) and then loops `hansanaRevealCycle` every 8 s, breathing to `opacity:.12` and back to full.

`./assets/bunny-live-wallpaper.mp4` remains the 100% default video: `DEFAULT_WALLPAPER_SRC`, `DB.defaults()`, the shipped `data/*.json` files and the `resetToV42` migration all select it with `activeMediaType: "video"`, `videoPlaylistMode: "loop"` and an 18% vignette, and any stored source outside `./assets/` is reset automatically. Only one hardware overlay plays (`filter:none`, `translateZ(0)`, `_loadedSrc` de-duplication), `#bgLiveAmbilight` stays `display:none` with no `src`, inactive gallery clips stay `preload="none"`, and GitHub discovery caches for fifteen minutes in `sdp.gh_assets_v42` while the `sdp.gh_assets_v41`/v40/v39 and older cache keys are purged on boot. Motion is GPU-only: 0.05 s control transforms, 0.12 s `transform`/`opacity` screen, sheet and player morphs and `contain: layout style` on screens, tiles and word rows, so low-end phones stay at 60 FPS; `LiveWallpaper.adaptPerformance()` also caps the neon canvas at 10 prismatic rings on `navigator.hardwareConcurrency <= 4` devices and pauses the video when the tab is hidden.

Every wallpaper URL is normalised before use: `normalizeAssetPath()` turns GitHub `download_url`, `https://dictationb1.github.io/assets/…`, `/assets/…`, `?v=34` and `#t=1.2` suffixes into the same-origin `./assets/<file>` path. `isAssetsMedia()` accepts those full URLs and still rejects `fatal-390`, `home-390`, posters and thumbnails. `#bgLiveVideo` has a real `src` attribute (no `<source>` children), muted autoplay, idempotent playback guards, stale Service Worker removal and `?v=41` JSON cache busters, so the video plays from the first millisecond on the live site. `DB.syncRemote()` sanitises published `data/config.json` / `data/session.json` values and always re-triggers `LiveWallpaper.ensurePlaying()`.

Tap **🎬 in the topbar** (or **Settings → Live Wallpaper Video → Choose Video from Device**) to play an MP4/WebM immediately without uploading it. The chosen video Blob is saved privately on this browser in IndexedDB; **Pause/Play** and **Reset to Default Repo Video** live in Settings. Device videos are not synced, exported in data backups, or uploaded to the repository. The click/swipe/audio neon canvas runs animation frames only while its short-lived rings or sparks are visible, then clears and sleeps; video decoding continues while the wallpaper is on. Auto and Lite constrain visual effects. Actual frame rate, autoplay policies, IndexedDB quota, power consumption and keyboard suggestions vary by device; 60–120 FPS cannot be guaranteed on all hardware. `QA_REPORT.md` and `PHASE1_QA.md` describe an earlier candidate.

## Add next week's words in three steps (candidate)

1. Unlock **Lecturer mode → Words & planner**. Paste the whole list: commas, semicolons, bullets, or one word per line. Multi-word entries such as “go shopping” stay together. For columns, use `word | sentence | meaning`, tabs, or CSV with a `word,sentence,meaning` header.
2. Check **“I read this as…”** and the counter. Use the one-tap format switch if necessary. Edit any preview cell, delete a row, or reorder using Drag / Up / Down (Up / Down work on phones). Correct all reported problems. Choose class-date chips (today plus the next four Tuesday/Wednesday dates), or another date/weekday in **Publish for**.
3. Tap **Publish to students** (or the sticky **Save & Publish Live** button) and check the word count, dates, and session number before confirming. It publishes the current preview, not the previous saved list, and a list called `Session 4 words` sets the session number to 4 by itself so the hero kicker and title always agree. Students need no setup at all: the published session is broadcast over the free ntfy.sh class channel, so online students can receive it over the live channel. Updating the repository JSON is a separate publishing step; delivery depends on network availability.

**Replace this list** and **Add to this list** are optional draft actions. Each preserves the existing short-lived Undo. The full requested published version-history/Undo workflow is still outstanding.

## Saved data and migration

- The current key is `sdp.v42_bugfree_single_voice`; `CONFIG.schema` and `settingsRev` are `42`.
- The v42 migration (`resetToV42`, which chains `resetToV41` → `resetToV40` → … → `resetToV22`) imports every older profile, preserving results, comments, custom lists and changed PINs while it switches the learner to English, paper mode, Amy at 0.96 and the bunny loop while resetting the upgraded default mode to paper, the wallpaper to `./assets/bunny-live-wallpaper.mp4` and the dimmer to 18%. Earlier storage keys remain available.
- Session 7 defaults to example sentences OFF, exactly two word repeats, a fixed 5-second writing timer, paper mode, dark theme and automatic performance selection.
- Corrupt primary data is retained under the current key's `.recovery` suffix; the rolling `.bak` copy can be used for recovery when available.
- Export a backup before experimenting. Browser storage can be cleared by the user or operating system; persistence is not guaranteed.

## The lecturer PIN is a convenience lock

The existing default PIN remains unchanged; historical default-PIN literals have also been removed from the current test/document files (not Git history). The shipped HTML contains only its precomputed salted SHA-256 verifier, not the PIN text. On successful login the verifier is re-salted and upgraded to PBKDF2-HMAC-SHA-256 (120,000 iterations, 256-bit output) when Web Crypto is available. Without Web Crypto, salted SHA-256 is retained. Existing changed PINs are verified with their old scheme before upgrade. PIN creation/change uses the strongest supported scheme.

**A four-digit PIN in a public page is not real protection.** Anyone who can edit their browser's JavaScript or local storage can bypass this local lock, and short PINs can be guessed offline. PBKDF2 does not change that fact. The five-try lockout, idle lock, and Lock now are convenience safeguards. Only server-side authorization can protect cloud publishing.

A PBKDF2 verifier cannot be verified in an old/insecure context lacking Web Crypto: the app explains this rather than silently downgrading its verification. Open the HTTPS app in a current browser. The student/player parts remain usable offline.

### Forgot the local PIN (preserve data)

1. Use **Settings → My data → backup/export** before doing anything else. A locked export intentionally excludes the lecturer's private inbox and authentication material. Do **not** clear all site storage or use Reset if you need existing work.
2. For a complete private recovery copy, on your own trusted computer use browser developer tools → Application/Storage → Local Storage and copy the value of `sdp.v32_crystal_video` to a private local file. **Never upload that file to GitHub or share it publicly.** It may contain private messages. A helper can instead use a previously saved full backup.
3. In the console for this site, run this convenience-lock recovery only on your own device:
   ```js
   var d = JSON.parse(localStorage.getItem('sdp.v28_live_video'));
   if (!d || !Array.isArray(d.lists)) throw new Error('Stop: saved data is not valid');
   d.admin = {};
   localStorage.setItem('sdp.v28_live_video', JSON.stringify(d));
   location.reload();
   ```
   Lists and student work remain; the local default verifier is seeded again. Unlock with the existing default, then **Settings & tools → Change PIN**. If you cannot use developer tools, ask a trusted helper; do not send your full backup to a public issue.

This does not reset the PIN on an Apps Script or future Worker server. Server recovery must happen in that service's secret settings.

## Live class channel (v2.0.0)

Three public [ntfy.sh](https://ntfy.sh) topics carry the class in real time. ntfy is free, open source, needs no account and no API key, allows browser CORS, and both caches the last messages and streams new ones over Server-Sent Events:

| Topic | What travels on it |
| --- | --- |
| `sdp_dictationb1_state_v8` | the published session: number, day, date, title, the 30 words and the plan |
| `sdp_dictationb1_comm_v8` | community posts and every student completion (`Completed Session 4 · Score: 27/30 (90%)`) |
| `sdp_dictationb1_inbox_v8` | a student's private message to the lecturer |

On load the app fetches `./data/version.json` **once** (~60 bytes) and only then `./data/session.json` when it is newer, does one `…/json?poll=1&since=24h` cached read and opens one `EventSource` stream only on a visible tab without Data Saver; whichever payload is newest (`publishedAt`/`ver`) wins. Publishing from Admin mode posts once and every open phone repaints. If a network blocks ntfy, the repository JSON still updates students on their next load, and the status chip says exactly which state the device is in (`Online · Live Sync · Synced …`, `Syncing…`, `Offline · Saved on device`).

**Privacy:** these topics are public, including the inbox topic. Anyone who knows a topic URL can read messages sent through it. Do not send sensitive or private information through the live channel; use an appropriately secured service for confidential communication. The lecturer PIN is not sent on this channel.

## Cloud: current adapter versus planned Worker

The existing Google Apps Script adapter is still supported. Its setup remains under **Lecturer → Settings & tools**, including the embedded script, Cloud URL and test control. It has not been newly deployed or end-to-end verified against Google in this change.

GitHub Pages is static, and this repository is public. A browser cannot safely write to GitHub with an embedded token: everyone visiting the page could extract it. The requested Phase 3 design uses a server-side Cloudflare Worker for authorization/rate limits and D1 for concurrent writes, with secrets kept outside this repository. Public state/community snapshots may be batched to GitHub; private messages must never go there.

**The Worker, D1 schema, contract tests and ten-minute setup wizard do not exist yet.** There are no Worker setup steps to run in this candidate. Do not create a GitHub token or paste one into the app. Phase 3 is blocked until Phases 1 and 2 are merged and smoke-tested, per the release plan. Do not enter secrets in chat, issues, or committed files.

## Development verification

Current v4.9.0 (v42) results in this sandbox: `node tests/check.cjs` **PASS** (strict ES5, zero static `<link>`, **436,932 / 450,000 bytes**), `node --test tests/upgrade.test.cjs` **38 PASS / 0 FAIL**, `node tests/phase1.cjs` **65 PASS / 0 FAIL**, `node tests/browser.cjs` **21 PASS / 1 SKIP** (the skip needs the historical baseline commit `7577968`), `node tests/upgrade-browser.cjs` **13 PASS / 0 FAIL**, `node tests/e2e.cjs` **58 PASS / 0 FAIL**, `node tests/audit-v42.cjs` **41 PASS / 0 FAIL** and `node tests/server.cjs` **7 PASS / 0 FAIL**. The Chromium suites (`browser.cjs`, `e2e.cjs`, `upgrade-browser.cjs`) were moved to the v42 key and the single-`en-GB`-voice playback contract and **do run** here once the bundled shared libraries are unpacked: `tar -xf tests/artifacts/al2023.tar -C tests/artifacts/chromium-libs` and `LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib" node tests/browser.cjs`. `tests/audit-v42.cjs` is the new real-Chromium troubleshooting audit for the v42 voice lifecycle (one endpoint, the `" ."` marker, the spoken/visual countdown sync, the dictation-number badge, pause/resume, the completion summary, the dead-host fallback and zero console/page errors).

```sh
npm ci --prefix tests
node tests/check.cjs
node tests/upgrade.test.cjs
node tests/phase1.cjs
node tests/upgrade-browser.cjs
npm test --prefix tests
```

For Chromium on the minimal sandbox:

```sh
mkdir -p tests/artifacts/chromium-libs
node -e 'const fs=require("fs"),z=require("zlib");fs.writeFileSync("tests/artifacts/al2023.tar",z.brotliDecompressSync(fs.readFileSync("tests/node_modules/@sparticuz/chromium/bin/al2023.tar.br")))'
tar -xf tests/artifacts/al2023.tar -C tests/artifacts/chromium-libs
export LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib"
node tests/upgrade-browser.cjs
npm run test:browser --prefix tests
npm run test:e2e --prefix tests
node tests/profile.cjs
```

The full historical E2E takes several minutes. On a normal development machine/CI, install Playwright's actual browsers, then select one:

```sh
./tests/node_modules/.bin/playwright-core install --with-deps chromium webkit
SDP_BROWSER_STANDARD=1 SDP_BROWSER=chromium node tests/upgrade-browser.cjs
SDP_BROWSER=webkit node tests/upgrade-browser.cjs
```

No test needs real cloud credentials. Test speech is synthetic; it verifies order/selection, not audible pronunciation or real iPhone audio policies. Raw traces and generated outputs stay in ignored `tests/artifacts/`.
