# Smart Dictation Player

Smart Dictation Player is a standalone, single-file English dictation app for CCBE Galle Branch. The published app is `index.html`; the interactive data report is available at both [`/data`](https://dictationb1.github.io/data) and [`/data.html`](https://dictationb1.github.io/data.html). There is no runtime JavaScript package or build requirement.

## Release 5.4.0 — v48

Released 2026-10-29 with Session 8, real remote human audio, Apple Liquid Glass styling and the interactive bilingual data report.

### Audio contract

There is deliberately **no `audio/` directory and no audio generator**. The app never creates waveform/formant/espeak clips and never uses robotic `speechSynthesis` on a live browser.

All speech uses one persistent `#ttsMasterAudio` element with `preload="auto"`, `playsinline`, `referrerpolicy="no-referrer"` and **no `crossOrigin` attribute**:

| Speech | Primary source | Ordered fallback |
| --- | --- | --- |
| A single English word | Oxford: `https://ssl.gstatic.com/dictionary/static/sounds/20200429/<word>--_gb_1.mp3` | Youdao UK: `https://dict.youdao.com/dictvoice?type=1&audio=<text>` |
| A number or phrase | Youdao UK | Google `translate_tts` with `client=gtx&tl=en-GB` |
| Sinhala narration | Google `translate_tts` with `tl=si`, sentence chunks no longer than 160 characters | — |

A dictation word follows this sequence:

1. Speak `Number N` and then the clean Oxford word, with a 150 ms hand-off.
2. Wait 650 ms after the word ends.
3. Rewind and replay that same loaded master element for Pass 2. No second clip is downloaded: the replay costs **0 KB**.
4. Start the five-second writing timer.

**Slower** uses `playbackRate = 0.72` with pitch preservation. Repeat sentence and spelling use the same remote engine. Only the current and next Oxford words are preloaded; the app never preloads the whole session or all prompt clips. A late error from an old URL cannot cancel a replacement stream that has already started.

Headless Chromium and jsdom treat media errors as a completed step after about 50 ms, without invoking device speech, so automated tests remain fast. Actual pronunciation, media availability, autoplay policy and network cost still depend on the browser and remote hosts.

### Session and interface

- **Session 8:** 30 adjectives for personal feelings, opinions and experiences, with UK IPA, Sinhala meanings, definitions and example sentences.
- **Session 7:** the complete 30-word Travel & Transport session remains archived and practiceable.
- `favourite`/`favorite` and `tyre`/`tire` are accepted spelling pairs; fuzzy near-misses do not receive credit.
- Paper mode, a fixed five-second writing timer and two readings remain the defaults. The ready sheet says **“Click I'm ready to begin”** and offers no skip-countdown control.
- The bunny video remains the default wallpaper in Full and Lite modes. Liquid Glass uses 16px-class radii, specular inset highlights and `backdrop-filter:none !important` rather than expensive full-screen blur.
- The top-centred **CREDITS GOES TO Hansana** badge stays at `z-index:9999` and runs `hansanaCinemaCycle`; reduced-motion preferences are respected.

### Interactive data report

`data.html` and `data/index.html` are the same self-contained ES5 page. It includes:

- bunny video background and a play/pause toggle;
- English/Sinhala interface switching and read-aloud summary;
- Full-video/Lite calculator for 1–30 sessions, repeat-session savings and video comparisons;
- all 30 Session 8 words with IPA, Sinhala meaning, estimated size and an Oxford play button;
- copy-link, WhatsApp, print, audit and open-player actions;
- responsive Liquid Glass cards and the animated Hansana credit.

The displayed estimates are clearly labelled estimates, not a promise of a particular mobile bill. First-run video is approximately 1.95 MB, audio-only Lite approximately 0.48 MB, and a warm repeat approximately 0.005 MB.

## Saved data and migration

- Storage key: `sdp.v48_real_oxford_voice`
- `APP_VERSION`: `5.4.0`
- `ver`, `schema` and `settingsRev`: `48`
- `data/version.json`, `data/config.json` and `data/session.json` carry the same release contract.

Migration retains learner results, comments, custom lists, archived sessions and changed PINs. Corrupt primary data is retained for recovery, with a rolling backup where available. Export a backup before experimenting; browser storage can always be cleared by the user or operating system.

The lecturer PIN remains a local convenience lock, not server-grade protection. Do not store GitHub credentials in the page or repository. Cloud publishing, private messages and public ntfy topics retain their existing privacy limitations; do not send confidential information through public channels.

## Development verification

Install the development-only test dependencies, then run all nine release gates from the repository root:

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

The static gate checks strict ES5 syntax and zero static `<link>` tags for the app and both data routes. `index.html` must remain below 430,000 bytes. Browser tests use the development-only Playwright/Chromium packages; `tests/chromium-env.cjs` supplies missing shared libraries on the minimal sandbox.

The E2E flow covers several viewport sizes and takes several minutes. For a focused run, use `SDP_E2E_ONLY=iphone`, `360`, `1280`, `old` or `offline`.

Tests record mocked **remote media URLs and completion events**. They do not use local fake MP3s, generate audio, contact real cloud accounts or prove real iPhone Safari audio policy. Historical comparison cases are skipped when their old Git objects are unavailable. Generated traces and screenshots belong in ignored `tests/artifacts/`, not in the published site.

To re-minify the inline app after editing it, run `node scripts/minify-inline.cjs`, then rerun every gate.
