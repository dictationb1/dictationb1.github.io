# Smart Dictation Player
Draft v2.0.0: NOT approved for deployment; see [test results and release blockers](tests/V2_REPORT.md).
Publish a class: unlock Lecturer mode, paste words, check the preview, choose a date and confirm Publish.
Until cloud setup is complete, local publishing does not distribute changes to other phones.
Apps Script setup: new Google Sheet → Extensions → Apps Script → paste the code from `#gas-source` in index.html.
Set script property `ADMIN_PIN` to your lecturer PIN; deploy as a web app, Execute as Me, access Anyone.
Put the deployed `/exec` URL in `data/config.json` as `cloudUrl`; no cloud URL was supplied for this draft.
GitHub-only publishing: update `data/session.json` and `data/version.json` through an authorised repository change.
Defaults and class days belong in `data/config.json`; full Tue/Wed planner integration is still TODO.
Old phone: close the app tab, open `https://dictationb1.github.io/?cb=20261014`, and reload; export a backup before clearing any website data.
The PIN is a UI lock only; server-side `ADMIN_PIN` protects cloud administration. Keep tokens out of this repo.
Cambridge audio is copyrighted and has no free API; keep its dictionary link, never scrape or copy its audio.
Credits: dictionaryapi.dev is the existing optional lookup source; starter meanings and sentences are authored here; no eSpeak files are bundled yet.
TODO first: vendor licensed offline UK eSpeak; then complete MUST A1–A8 and acceptance coverage before merge; SHOULD B1–B4 remain outstanding.
Later: network-first PWA; licence-checked Piper voices; Cambridge audio only with permission. No analytics; public comments are public, lecturer messages must stay private.
