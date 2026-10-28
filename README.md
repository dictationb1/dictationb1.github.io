# Smart Dictation Player

A standalone, offline-capable ES5 `index.html` with two bundled wallpaper assets in `assets/`. No build, CDN, or runtime JavaScript dependency. Open the file directly, or serve it over HTTPS. Development test packages are not used by the app.

## Release status

**4.1.0 (v34, 2026-10-27)** keeps Session 7 — Travel & Transport (30 words, two repeats, a fixed 5-second writing timer and British Amy voice by default), paper and typing modes, the bilingual guide and live class channel.

Every button, control, card and word now pops out 100% clearly over the live wallpaper. Primary actions (`.btn.pri`, `.btn-pri`, `.btn.primary`, `#btnStart`, `#btnReadyGo`, `.gal-apply-btn`) are a vivid coral-magenta gradient with white 800 text, a bright white rim and a dark outer contrast ring. Secondary, ghost, icon, pill and player buttons (`.btn`, `.btn-sec`, `.btn-ghost`, `.ibtn`, `.top-pill`, `.wall-open-btn`, `.gal-preview-btn`, `.close-x-btn`) are a dark obsidian capsule with a glowing cyan border instead of the old `rgba(255,255,255,.06)` ghost fill, and light mode swaps them to white capsules with dark ink. Segmented switches use a cyan→blue→indigo active thumb, the active dock tab is neon-ringed, and the top bar and dock are `rgba(6,11,24,.86)`.

Cards stay see-through but readable: `.glass`, `#homeHero.glass`, `.wordcard.glass`, `.card.glass`, `.sheet` and `.modal` use a dark 0.50–0.68 gradient stage with a white rim and a dark contrast ring (`rgba(255,255,255,.82)` in light mode), tiles/word rows/stat cards are `rgba(7,13,28,.78)`, chips are `rgba(8,15,32,.90)`, and `#ansMirror`, `.slot`, `#dictSearch` and every input carry a 2px cyan border with white 700 text. `#homeTitle` (and `.hollow`) is solid luminous white at weight 900 with a cyan outline and a black halo instead of transparent hollow text, `--fg`/`--muted` are `#ffffff`/`#e4eeff` in dark mode, and every label inside `.glass`, `.layer`, `.sheet`, `.topbar` and `.tile` gets a crisp dark halo. All of this is **blur-free**: no `backdrop-filter` anywhere, so GPU frame time stays under 1 ms and the live video stays crisp.

`./assets/bunny-live-wallpaper.mp4` remains the 100% default video: `DEFAULT_WALLPAPER_SRC`, `DB.defaults()`, the shipped `data/*.json` files and the `resetToV34` migration all select it with `activeMediaType: "video"`, `videoPlaylistMode: "loop"` and an 18% vignette, and any stored source outside `./assets/` is reset automatically. Only one hardware overlay plays (`filter:none`, `translateZ(0)`, `_loadedSrc` de-duplication), `#bgLiveAmbilight` stays `display:none` with no `src`, inactive gallery clips stay `preload="none"`, and GitHub discovery caches for fifteen minutes in `sdp.gh_assets_v34` while the v33/v32/v31/v30 cache keys are purged on boot.

Every wallpaper URL is normalised before use: `normalizeAssetPath()` turns GitHub `download_url`, `https://dictationb1.github.io/assets/…`, `/assets/…`, `?v=34` and `#t=1.2` suffixes into the same-origin `./assets/<file>` path. `isAssetsMedia()` accepts those full URLs and still rejects `fatal-390`, `home-390`, posters and thumbnails. `#bgLiveVideo` has a real `src` attribute (no `<source>` children), muted autoplay, idempotent playback guards, stale Service Worker removal and `?v=34` JSON cache busters, so the video plays from the first millisecond on the live site. `DB.syncRemote()` sanitises published `data/config.json` / `data/session.json` values and always re-triggers `LiveWallpaper.ensurePlaying()`.

Tap **🎬 in the topbar** (or **Settings → Live Wallpaper Video → Choose Video from Device**) to play an MP4/WebM immediately without uploading it. The chosen video Blob is saved privately on this browser in IndexedDB; **Pause/Play** and **Reset to Default Repo Video** live in Settings. Device videos are not synced, exported in data backups, or uploaded to the repository. The click/swipe/audio neon canvas runs animation frames only while its short-lived rings or sparks are visible, then clears and sleeps; video decoding continues while the wallpaper is on. Auto and Lite constrain visual effects. Actual frame rate, autoplay policies, IndexedDB quota, power consumption and keyboard suggestions vary by device; 60–120 FPS cannot be guaranteed on all hardware. `QA_REPORT.md` and `PHASE1_QA.md` describe an earlier candidate.

## Add next week's words in three steps (candidate)

1. Unlock **Lecturer mode → Words & planner**. Paste the whole list: commas, semicolons, bullets, or one word per line. Multi-word entries such as “go shopping” stay together. For columns, use `word | sentence | meaning`, tabs, or CSV with a `word,sentence,meaning` header.
2. Check **“I read this as…”** and the counter. Use the one-tap format switch if necessary. Edit any preview cell, delete a row, or reorder using Drag / Up / Down (Up / Down work on phones). Correct all reported problems. Choose class-date chips (today plus the next four Tuesday/Wednesday dates), or another date/weekday in **Publish for**.
3. Tap **Publish to students** (or the sticky **Save & Publish Live** button) and check the word count, dates, and session number before confirming. It publishes the current preview, not the previous saved list, and a list called `Session 4 words` sets the session number to 4 by itself so the hero kicker and title always agree. Students need no setup at all: the published session is broadcast over the free ntfy.sh class channel, so online students can receive it over the live channel. Updating the repository JSON is a separate publishing step; delivery depends on network availability.

**Replace this list** and **Add to this list** are optional draft actions. Each preserves the existing short-lived Undo. The full requested published version-history/Undo workflow is still outstanding.

## Saved data and migration

- The current key is `sdp.v34_highlighted_ui`; `CONFIG.schema` and `settingsRev` are `34`.
- The v34 migration imports v33, v32, v31, v30, v29, v28 and supported older storage, preserving results, comments, custom lists and changed PINs while resetting the upgraded default mode to paper, the wallpaper to `./assets/bunny-live-wallpaper.mp4` and the dimmer to 18%. Earlier storage keys remain available.
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
