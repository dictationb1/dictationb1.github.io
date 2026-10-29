# Smart Dictation Player

Smart Dictation Player is a self-contained English dictation app for CCBE Galle Branch. The player is `index.html`; the interactive bilingual data report is available at `/data` and `/data.html`.

## Release 5.6.0 — v50

The Session 8 lesson contains 30 adjectives with UK IPA, Sinhala meanings and examples. Session 7 remains available for practice. Paper mode, two readings and a five-second writing period are the defaults.

### Audio and player controls

- A word cycle plays `Number N`, waits 120 ms, plays the clean word, waits 650 ms and plays the **same word URL** again. The last item is introduced as “Final word, number N”.
- Single English words request `dict.youdao.com/dictvoice?type=1&audio=<word>` without added punctuation. If that fails, the player tries the Google dictionary UK URL. Phrases use the direct Youdao URL. Requests go straight to a single `<audio>` element, without a JavaScript audio fetch or Blob cache.
- If remote audio fails, an available British female device voice is preferred. Voice selection is refreshed when the browser announces newly loaded voices. `Slower` sets both `defaultPlaybackRate` and `playbackRate` to `0.72` after the media loads and uses that rate for the device fallback too.
- Sinhala guide audio requests the specified Youdao Sinhala URL in chunks of at most 180 characters. If it fails, the app tries an installed `si-LK` voice or an **approximate romanised** reading with the device voice. If no audio engine is available, the guide remains readable and shows a message.
- Repeat, Slower, Repeat sentence and Spell it cancel the current timer. The five-second writing period starts only after the helper audio finishes. Pause cancels speech and timers; Resume waits for its welcome-back prompt before restarting the current word.

Remote providers and installed voices vary by device and network. The code requests UK dictionary recordings, but it cannot guarantee a particular speaker, accent, pronunciation, Sinhala support or uninterrupted service. The automated tests intercept remote audio and **do not certify the audio content or provider availability**. Browser caching and mobile data usage also vary; the report's figures are estimates.

### Appearance and accessibility

Full performance is the default, while Lite remains selectable. Both retain the Liquid Glass sheen and inset highlights. The Hansana credit has a seven-second disappearing/reappearing animation and reserved clearance above player controls. At the requested design's direction, this particular animation also runs when the system requests reduced motion; other reduced-motion rules continue to apply.

### Saved data

- Storage key: `sdp.v50_all_p0_p6_fixed`
- `APP_VERSION`: `5.6.0`; `ver`, `schema` and `settingsRev`: `50`
- The default local lecturer PIN is `78987898`.

The migration reads the v49 key and older known keys, preserving learner lists, history and comments. It sets Full as the upgrade default, but a subsequent manual Lite selection is retained. The PIN is a local convenience lock, not server-grade protection. Export a backup before experimenting and do not store credentials in the app.

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
