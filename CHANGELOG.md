# Changelog

## v61 / 9.0.1.0 — One App, One UI, Zero Layers

- Removed the five stacked legacy UI layers (v57 inline CSS/JS, v58/v59 injected styles, v60 wrapper, v604 janitor/cloak). The app now ships one static `<style id="sdpCss">`, one extracted engine `data/app-core.js`, and one ES5 `SDP61` module `data/learning-tools.js`.
- Rebuilt the dictation player as a single-screen cockpit: phase edge, countdown ring, paper slots or typing input, four voice helpers, compact transport, live counters and word map. No legacy `.ctrlgrid`, `#plRing` or `#plBars`; no auto-focus or scroll yank.
- Settings is one screen with three groups (Dictation & learning, My data & sync, About & device). Sinhala voice is honestly marked as not recorded; the six 11-byte fake guide MP3s were deleted.
- Hardened `Speech.say` to an array-only contract, removed the 80 ms focus timer and ready-sheet interstitial, wired `Cloud.onSync`, and aligned version stamps / service worker to `sdp-v61-9.0.1.0`.
- Preserved encrypted vault/session-secret scrub, GitHub-only lecturer sync, offline storage, weak/mastered graduation, print sheet, interactive paper self-check, PerfGuard and the static footer credit.
