# Smart Dictation Player

A standalone, offline-capable ES5 `index.html` with two bundled wallpaper assets in `assets/`. No build, CDN, or runtime JavaScript dependency. Open the file directly, or serve it over HTTPS. Development test packages are not used by the app.

## Release status

**4.3.0 (v36, 2026-10-28)** keeps Session 7 — Travel & Transport (30 words, two repeats, a fixed 5-second writing timer and British Amy voice by default), paper and typing modes, the bilingual guide and live class channel.

Every tap now answers in **0.05s (50ms)**: all controls share `transition: transform 0.05s cubic-bezier(0.2,0,0,1), opacity 0.05s linear, background-color 0.08s linear`, a `scale(0.97) translateZ(0)` press at `0.03s` and `touch-action: manipulation`, screens/sheets/layers morph in `0.12s` on `transform`/`opacity` only, `DB.save()` is a 60 ms debounce (`DB.saveNow()` stays synchronous) and the ambient canvas ignores taps on any control — so a click never waits on `JSON.stringify`, a paint stall or a particle allocation. The synthetic neon look is gone: primary actions (`.btn.pri`, `.btn-pri`, `.btn.primary`, `#btnStart`, `#btnReadyGo`, `button.pri`, `.gal-apply-btn`) are deep sapphire-indigo-azure pearlescent pills (`linear-gradient(135deg,#2563eb,#4f46e5 52%,#0891b2)` under a glass catchlight, 700 white text, 14px radius, a 1px `rgba(255,255,255,.42)` rim and `0 6px 18px rgba(37,99,235,.42)`), while secondary, ghost, icon and pill buttons are matte smoked-obsidian capsules (`#1e293b→#0f172a`, 600 weight, 12px radius, hairline specular border). The gradient dock droplet is now one calm sapphire pill.

Cards are smoked-crystal editorial surfaces with **zero GPU blur**: `.glass`, `#homeHero.glass`, `.wordcard.glass`, `.card.glass`, `.sheet`, `.modal` use `linear-gradient(180deg, rgba(15,23,42,.68), rgba(9,14,28,.76))` at a 22px radius with a 1px `rgba(255,255,255,.22)` rim and one crisp `0 16px 36px rgba(0,0,0,.50)` shadow (light mode `#f8fafc`/`#e2e8f0`); `.tile`, `.wrow` and `.dict-item` are `rgba(15,23,42,.78)` at 16px; and `#ansMirror`, `.slot`, `#dictSearch` and every input are `rgba(9,14,28,.90)` with a `1.5px rgba(96,165,250,.65)` border and white text. `#homeTitle` is solid `#ffffff` at weight 800 with a crisp two-layer halo, and `backdrop-filter: none !important` is still on every surface.

**"CREDITS GOES TO Hansana" is the first thing the eye reads.** On load `UI.showCreditNow()` adds `body.credit-intro` for 2.6 s and the swan badge glides to the top-centre reading focal point as a warm golden-pearl spotlight pill (`#0f172a→#1e3a8a`, `1.5px rgba(251,191,36,.75)` rim, golden bloom), then hands over to `animation: hansanaRevealCycle 7.5s cubic-bezier(.22,1,.36,1) infinite`: crisp to 58%, faded to `opacity:.08` between 72–82%, popping back to full at 92% with a golden `hansanaShimmer` sweep. It keeps `z-index: 9999` and stays in the DOM with `opacity > 0` at every millisecond, and it re-triggers on every Home return and language switch.

English and Sinhala both use modern professional type: `--font-sans` starts with **Inter** and **Plus Jakarta Sans** and falls back through `"Noto Sans Sinhala"`, `"Sinhala Sangam MN"`, `"Nirmala UI"` and `"Malithi Web"`; `--font-sinhala` is Sinhala-first, and `.si`, `[lang="si"]` and `#guideBody` are set to `line-height: 1.72` with weight 500 so ඉස්පිල්ල, පාපිල්ල and කොම්බුව never clip (the Windows XP `Iskoola Pota` fallback is gone). Real Inter + Noto Sans Sinhala arrive through one runtime `<style id="sdpDynamicFonts">` injected 80 ms after boot, online-only and never in headless QA — there is still **zero** static `<link>` in `index.html`.

`./assets/bunny-live-wallpaper.mp4` remains the 100% default video: `DEFAULT_WALLPAPER_SRC`, `DB.defaults()`, the shipped `data/*.json` files and the `resetToV36` migration all select it with `activeMediaType: "video"`, `videoPlaylistMode: "loop"` and an 18% vignette, and any stored source outside `./assets/` is reset automatically. Only one hardware overlay plays (`filter:none`, `translateZ(0)`, `_loadedSrc` de-duplication), `#bgLiveAmbilight` stays `display:none` with no `src`, inactive gallery clips stay `preload="none"`, and GitHub discovery caches for fifteen minutes in `sdp.gh_assets_v36` while the v34/v33/v32/v31/v30 cache keys are purged on boot. Motion is GPU-only: 0.05 s control transforms, 0.12 s `transform`/`opacity` screen, sheet and player morphs and `contain: layout style` on screens, tiles and word rows, so low-end phones stay at 60 FPS; `LiveWallpaper.adaptPerformance()` also caps the neon canvas at 10 prismatic rings on `navigator.hardwareConcurrency <= 4` devices and pauses the video when the tab is hidden.

Every wallpaper URL is normalised before use: `normalizeAssetPath()` turns GitHub `download_url`, `https://dictationb1.github.io/assets/…`, `/assets/…`, `?v=34` and `#t=1.2` suffixes into the same-origin `./assets/<file>` path. `isAssetsMedia()` accepts those full URLs and still rejects `fatal-390`, `home-390`, posters and thumbnails. `#bgLiveVideo` has a real `src` attribute (no `<source>` children), muted autoplay, idempotent playback guards, stale Service Worker removal and `?v=34` JSON cache busters, so the video plays from the first millisecond on the live site. `DB.syncRemote()` sanitises published `data/config.json` / `data/session.json` values and always re-triggers `LiveWallpaper.ensurePlaying()`.

Tap **🎬 in the topbar** (or **Settings → Live Wallpaper Video → Choose Video from Device**) to play an MP4/WebM immediately without uploading it. The chosen video Blob is saved privately on this browser in IndexedDB; **Pause/Play** and **Reset to Default Repo Video** live in Settings. Device videos are not synced, exported in data backups, or uploaded to the repository. The click/swipe/audio neon canvas runs animation frames only while its short-lived rings or sparks are visible, then clears and sleeps; video decoding continues while the wallpaper is on. Auto and Lite constrain visual effects. Actual frame rate, autoplay policies, IndexedDB quota, power consumption and keyboard suggestions vary by device; 60–120 FPS cannot be guaranteed on all hardware. `QA_REPORT.md` and `PHASE1_QA.md` describe an earlier candidate.

## Add next week's words in three steps (candidate)

1. Unlock **Lecturer mode → Words & planner**. Paste the whole list: commas, semicolons, bullets, or one word per line. Multi-word entries such as “go shopping” stay together. For columns, use `word | sentence | meaning`, tabs, or CSV with a `word,sentence,meaning` header.
2. Check **“I read this as…”** and the counter. Use the one-tap format switch if necessary. Edit any preview cell, delete a row, or reorder using Drag / Up / Down (Up / Down work on phones). Correct all reported problems. Choose class-date chips (today plus the next four Tuesday/Wednesday dates), or another date/weekday in **Publish for**.
3. Tap **Publish to students** (or the sticky **Save & Publish Live** button) and check the word count, dates, and session number before confirming. It publishes the current preview, not the previous saved list, and a list called `Session 4 words` sets the session number to 4 by itself so the hero kicker and title always agree. Students need no setup at all: the published session is broadcast over the free ntfy.sh class channel, so online students can receive it over the live channel. Updating the repository JSON is a separate publishing step; delivery depends on network availability.

**Replace this list** and **Add to this list** are optional draft actions. Each preserves the existing short-lived Undo. The full requested published version-history/Undo workflow is still outstanding.

## Saved data and migration

- The current key is `sdp.v36_human_editorial`; `CONFIG.schema` and `settingsRev` are `36`.
- The v36 migration (`resetToV36`, which chains `resetToV35`) imports v35, v34, v33, v32, v31, v30, v29, v28 and supported older storage, preserving results, comments, custom lists and changed PINs while resetting the upgraded default mode to paper, the wallpaper to `./assets/bunny-live-wallpaper.mp4` and the dimmer to 18%. Earlier storage keys remain available.
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
